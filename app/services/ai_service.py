import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthenticatedUser
from app.ml.pipeline import run_ai_pipeline
from app.ml.scheduler import ai_scheduler
from app.repositories.ai_repo import AiRepository
from app.schemas.ai import (
    AiRecalculateResponse,
    AiRecommendationOut,
    AiRecommendationsResponse,
    AssetHealthOut,
    AssetHealthResponse,
    FailurePredictionOut,
    FailurePredictionsResponse,
    GridRiskIndexOut,
    GridRiskResponse,
    IncidentPatternOut,
    IncidentPatternsResponse,
    ModelPerformanceMetricsOut,
)

logger = logging.getLogger("gridguard.ai.service")


class AiService:
    """Service layer orchestrating Phase 7 AI asset health, predictions, risk indices, and recommendations."""

    def __init__(self, db: AsyncSession) -> None:
        self.repo = AiRepository(db)

    async def _compute_snapshot(self, trigger_source: str = "API_QUERY") -> Dict[str, Any]:
        if trigger_source == "API_QUERY" and ai_scheduler.latest_snapshot is not None:
            return ai_scheduler.latest_snapshot

        assets: Optional[List[Dict[str, Any]]] = None
        faults: Optional[List[Dict[str, Any]]] = None
        try:
            db_assets, db_faults = await self.repo.load_live_assets_and_faults()
            if db_assets:
                assets = db_assets
                faults = db_faults
        except Exception as exc:
            logger.debug("Using canonical seeded topology for AI pipeline (DB unavailable: %s)", exc)

        snapshot = run_ai_pipeline(assets=assets, faults=faults, trigger_source=trigger_source)
        ai_scheduler.latest_snapshot = snapshot
        return snapshot

    async def get_health(
        self,
        state: Optional[str] = None,
        district: Optional[str] = None,
        category: Optional[str] = None,
        asset_id: Optional[str] = None,
    ) -> AssetHealthResponse:
        snapshot = await self._compute_snapshot("API_QUERY")
        items = snapshot["health_scores"]
        if state:
            items = [h for h in items if h["state"].lower() == state.lower()]
        if district:
            items = [h for h in items if h["district"].lower() == district.lower()]
        if category:
            items = [h for h in items if h["category"].upper() == category.upper()]
        if asset_id:
            items = [h for h in items if h["asset_id"].upper() == asset_id.upper()]
        return AssetHealthResponse(
            count=len(items),
            recalculated_at=snapshot["recalculated_at"],
            items=[AssetHealthOut.model_validate(i) for i in items],
        )

    async def get_predictions(
        self,
        risk_level: Optional[str] = None,
        asset_id: Optional[str] = None,
        failure_type: Optional[str] = None,
    ) -> FailurePredictionsResponse:
        snapshot = await self._compute_snapshot("API_QUERY")
        items = snapshot["predictions"]
        if risk_level:
            items = [p for p in items if p["risk_level"].upper() == risk_level.upper()]
        if asset_id:
            items = [p for p in items if p["asset_id"].upper() == asset_id.upper()]
        if failure_type:
            items = [p for p in items if p["failure_type"].upper() == failure_type.upper()]
        return FailurePredictionsResponse(
            count=len(items),
            recalculated_at=snapshot["recalculated_at"],
            items=[FailurePredictionOut.model_validate(i) for i in items],
        )

    async def get_risk(
        self,
        scope_level: Optional[str] = None,
        risk_level: Optional[str] = None,
    ) -> GridRiskResponse:
        snapshot = await self._compute_snapshot("API_QUERY")
        items = snapshot["risk_indices"]
        if scope_level:
            items = [r for r in items if r["scope_level"].upper() == scope_level.upper()]
        if risk_level:
            items = [r for r in items if r["risk_level"].upper() == risk_level.upper()]
        return GridRiskResponse(
            count=len(items),
            recalculated_at=snapshot["recalculated_at"],
            items=[GridRiskIndexOut.model_validate(i) for i in items],
        )

    async def get_recommendations(
        self,
        priority: Optional[str] = None,
        asset_id: Optional[str] = None,
    ) -> AiRecommendationsResponse:
        snapshot = await self._compute_snapshot("API_QUERY")
        items = snapshot["recommendations"]
        if priority:
            items = [r for r in items if r["priority"].upper() == priority.upper()]
        if asset_id:
            items = [r for r in items if r["asset_id"].upper() == asset_id.upper()]
        return AiRecommendationsResponse(
            count=len(items),
            recalculated_at=snapshot["recalculated_at"],
            items=[AiRecommendationOut.model_validate(i) for i in items],
        )

    async def get_patterns(
        self,
        severity: Optional[str] = None,
    ) -> IncidentPatternsResponse:
        snapshot = await self._compute_snapshot("API_QUERY")
        items = snapshot["patterns"]
        if severity:
            items = [p for p in items if p["severity"].upper() == severity.upper()]
        return IncidentPatternsResponse(
            count=len(items),
            recalculated_at=snapshot["recalculated_at"],
            items=[IncidentPatternOut.model_validate(i) for i in items],
        )

    async def recalculate(
        self,
        user: AuthenticatedUser,
        reason: str = "Manual engineer AI model recalculation",
    ) -> AiRecalculateResponse:
        snapshot = await self._compute_snapshot(f"MANUAL:{reason[:32]}")
        try:
            await self.repo.persist_snapshot(
                snapshot=snapshot,
                actor_email=user.email,
                actor_role=user.role.value,
            )
        except Exception as exc:
            logger.warning("AI snapshot PostgreSQL persistence skipped (DB offline): %s", exc)

        return AiRecalculateResponse(
            status="RECALCULATED",
            recalculated_at=snapshot["recalculated_at"],
            assets_scored=len(snapshot["health_scores"]),
            predictions_generated=len(snapshot["predictions"]),
            recommendations_generated=len(snapshot["recommendations"]),
            model_metrics=ModelPerformanceMetricsOut.model_validate(snapshot["model_metrics"]),
        )
