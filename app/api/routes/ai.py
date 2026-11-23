from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.core.security import AuthenticatedUser, UserRole
from app.schemas.ai import (
    AiRecalculateRequest,
    AiRecalculateResponse,
    AiRecommendationsResponse,
    AssetHealthResponse,
    FailurePredictionsResponse,
    GridRiskResponse,
    IncidentPatternsResponse,
)
from app.services.ai_service import AiService

router = APIRouter(prefix="/ai", tags=["AI Predictive Intelligence"])


@router.get(
    "/health",
    response_model=AssetHealthResponse,
    summary="Compute and return multi-factor Asset Health Scores (0-100)",
)
async def get_asset_health_scores(
    state: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    asset_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> AssetHealthResponse:
    service = AiService(db)
    return await service.get_health(
        state=state,
        district=district,
        category=category,
        asset_id=asset_id,
    )


@router.get(
    "/predictions",
    response_model=FailurePredictionsResponse,
    summary="Retrieve ML-backed equipment failure probability forecasts",
)
async def get_failure_predictions(
    risk_level: Optional[str] = Query(default=None),
    asset_id: Optional[str] = Query(default=None),
    failure_type: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> FailurePredictionsResponse:
    service = AiService(db)
    return await service.get_predictions(
        risk_level=risk_level,
        asset_id=asset_id,
        failure_type=failure_type,
    )


@router.get(
    "/risk",
    response_model=GridRiskResponse,
    summary="Retrieve Grid Risk Index across State, District, Area, Substation, and Feeder scopes",
)
async def get_grid_risk_indices(
    scope_level: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> GridRiskResponse:
    service = AiService(db)
    return await service.get_risk(scope_level=scope_level, risk_level=risk_level)


@router.get(
    "/recommendations",
    response_model=AiRecommendationsResponse,
    summary="Retrieve Explainable AI preventive and operational recommendations",
)
async def get_ai_recommendations(
    priority: Optional[str] = Query(default=None),
    asset_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> AiRecommendationsResponse:
    service = AiService(db)
    return await service.get_recommendations(priority=priority, asset_id=asset_id)


@router.get(
    "/patterns",
    response_model=IncidentPatternsResponse,
    summary="Retrieve AI-detected historical incident and overload patterns",
)
async def get_incident_patterns(
    severity: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> IncidentPatternsResponse:
    service = AiService(db)
    return await service.get_patterns(severity=severity)


@router.post(
    "/recalculate",
    response_model=AiRecalculateResponse,
    summary="Trigger on-demand AI ML model retraining and health recalculation (RBAC protected)",
)
async def recalculate_ai_models(
    payload: AiRecalculateRequest = AiRecalculateRequest(),
    user: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.UTILITY_MANAGER,
            UserRole.CONTROL_ROOM_ENGINEER,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> AiRecalculateResponse:
    service = AiService(db)
    return await service.recalculate(user=user, reason=payload.reason)
