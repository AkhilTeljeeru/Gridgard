from typing import Any, Dict, List, Optional, Sequence
import uuid
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import (
    AiRecommendationModel,
    AssetHealthModel,
    GridRiskIndexModel,
    ModelRunLogModel,
    PredictionModel,
)
from app.models.geography import Area, District, State
from app.models.governance import AuditLogModel
from app.models.grid import Fault, UtilityAsset


class AiRepository:
    """Async SQLAlchemy repository for Phase 7 AI Intelligence tables & live asset reads."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def load_live_assets_and_faults(
        self,
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Load canonical assets and faults from PostgreSQL/PostGIS if populated."""
        asset_stmt = (
            select(
                UtilityAsset,
                State.name.label("state_name"),
                District.name.label("district_name"),
                Area.name.label("area_name"),
            )
            .join(State, UtilityAsset.state_id == State.id)
            .join(District, UtilityAsset.district_id == District.id)
            .join(Area, UtilityAsset.area_id == Area.id)
        )
        asset_rows = (await self.db.execute(asset_stmt)).all()
        assets: List[Dict[str, Any]] = []
        for row in asset_rows:
            ua: UtilityAsset = row[0]
            assets.append(
                {
                    "asset_id": ua.asset_id,
                    "asset_name": ua.asset_name,
                    "asset_type": ua.asset_type,
                    "state": row[1],
                    "district": row[2],
                    "area": row[3],
                    "substation_id": ua.substation_code,
                    "feeder_id": ua.feeder_code,
                    "status": ua.operational_status,
                    "peak_load_pct": (ua.extra_metadata or {}).get("peak_load_pct"),
                    "installation_date": ua.installation_date.isoformat() if ua.installation_date else None,
                    "last_inspection_date": ua.last_maintenance.isoformat() if ua.last_maintenance else None,
                    "latitude": ua.latitude,
                    "longitude": ua.longitude,
                    "source": ua.source,
                }
            )

        fault_rows: Sequence[Fault] = (await self.db.execute(select(Fault))).scalars().all()
        faults: List[Dict[str, Any]] = [
            {
                "fault_id": f.fault_id,
                "asset_id": f.asset_id,
                "severity": f.severity,
                "status": f.status,
            }
            for f in fault_rows
        ]
        return assets, faults

    async def persist_snapshot(
        self,
        snapshot: Dict[str, Any],
        actor_email: str = "system@gridguard.ai",
        actor_role: str = "Administrator",
    ) -> None:
        """Persist latest AI health, predictions, recommendations, risk indices, and model run log."""
        await self.db.execute(delete(AssetHealthModel))
        await self.db.execute(delete(PredictionModel))
        await self.db.execute(delete(AiRecommendationModel))
        await self.db.execute(delete(GridRiskIndexModel))

        for item in snapshot["health_scores"]:
            self.db.add(
                AssetHealthModel(
                    asset_id=item["asset_id"],
                    asset_name=item["asset_name"],
                    asset_type=item["asset_type"],
                    state=item["state"],
                    district=item["district"],
                    area=item["area"],
                    substation_id=item.get("substation_id"),
                    feeder_id=item.get("feeder_id"),
                    health_score=item["health_score"],
                    category=item["category"],
                    risk_level=item["risk_level"],
                    age_years=item["age_years"],
                    maintenance_overdue_days=item["maintenance_overdue_days"],
                    historical_fault_count=item["historical_fault_count"],
                    downtime_hours_90d=item["downtime_hours_90d"],
                    voltage_deviation_pct=item["voltage_deviation_pct"],
                    peak_load_pct=item["peak_load_pct"],
                    temperature_trend_c=item.get("temperature_trend_c"),
                    factors=item["factors"],
                    source=item["source"],
                )
            )

        for pred in snapshot["predictions"]:
            self.db.add(
                PredictionModel(
                    prediction_id=pred["prediction_id"],
                    asset_id=pred["asset_id"],
                    asset_name=pred["asset_name"],
                    asset_type=pred["asset_type"],
                    failure_type=pred["failure_type"],
                    probability_pct=pred["probability_pct"],
                    confidence_score=pred["confidence_score"],
                    estimated_failure_window=pred["estimated_failure_window"],
                    predicted_date=pred["predicted_date"],
                    risk_level=pred["risk_level"],
                    contributing_factors=pred["contributing_factors"],
                    recommended_action=pred["recommended_action"],
                    supporting_evidence=pred["supporting_evidence"],
                    source=pred["source"],
                )
            )

        for rec in snapshot["recommendations"]:
            self.db.add(
                AiRecommendationModel(
                    recommendation_id=rec["recommendation_id"],
                    asset_id=rec["asset_id"],
                    asset_name=rec["asset_name"],
                    health_score=rec["health_score"],
                    priority=rec["priority"],
                    recommendation=rec["recommendation"],
                    reasons=rec["reasons"],
                    expected_risk_reduction_pct=rec["expected_risk_reduction_pct"],
                    confidence_score=rec["confidence_score"],
                    linked_prediction_id=rec.get("linked_prediction_id"),
                    source=rec["source"],
                )
            )

        for risk in snapshot["risk_indices"]:
            self.db.add(
                GridRiskIndexModel(
                    risk_id=risk["risk_id"],
                    scope_level=risk["scope_level"],
                    name=risk["name"],
                    parent_label=risk["parent_label"],
                    risk_score=risk["risk_score"],
                    risk_level=risk["risk_level"],
                    active_incidents_count=risk["active_incidents_count"],
                    historical_failures_count=risk["historical_failures_count"],
                    avg_asset_health=risk["avg_asset_health"],
                    avg_load_pct=risk["avg_load_pct"],
                )
            )

        metrics = snapshot["model_metrics"]
        self.db.add(
            ModelRunLogModel(
                run_id=f"MLRUN-{uuid.uuid4().hex[:10].upper()}",
                model_version=metrics["model_version"],
                algorithm=metrics["algorithm"],
                trigger_source=metrics.get("trigger_source", "MANUAL"),
                training_samples=metrics["training_samples"],
                precision_pct=metrics["precision_pct"],
                recall_pct=metrics["recall_pct"],
                f1_score=metrics["f1_score"],
                roc_auc=metrics["roc_auc"],
                drift_status=metrics["drift_status"],
            )
        )

        self.db.add(
            AuditLogModel(
                audit_id=f"AUD-{uuid.uuid4().hex[:12].upper()}",
                actor_email=actor_email,
                actor_role=actor_role,
                action_type="AI_RECALCULATED",
                module="AI Predictive Intelligence",
                target_entity="ai_model_runs",
                entity_id=metrics["model_version"],
                change_summary=(
                    f"Executed AI predictive pipeline ({len(snapshot['health_scores'])} assets scored, "
                    f"F1={metrics['f1_score']})."
                ),
                metadata_json={"trigger_source": metrics.get("trigger_source", "MANUAL")},
            )
        )
        await self.db.commit()
