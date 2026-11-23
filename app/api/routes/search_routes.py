from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.grid import RouteSegmentOut, UnifiedSearchResponse
from app.services.grid_service import GridService

router = APIRouter(tags=["Search & Corridor Routing"])


@router.get(
    "/search",
    response_model=UnifiedSearchResponse,
    summary="Unified Search Across Asset ID, Substation, Feeder, Transformer, Area, City, District, State",
)
async def unified_search(
    q: str = Query(..., min_length=1, max_length=120, description="Search query string"),
    limit: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> UnifiedSearchResponse:
    service = GridService(db)
    return await service.unified_search(q, limit=limit)


@router.get(
    "/routes",
    response_model=RouteSegmentOut,
    summary="Compute Electrical Feeder Corridor Path & Ordered Asset Hops",
)
async def get_feeder_corridor_route(
    feeder_code: Optional[str] = Query(default=None, description="Canonical feeder code (e.g. FDR-TG-06U-01)"),
    from_asset_id: Optional[str] = Query(default=None, description="Origin canonical asset_id"),
    to_asset_id: Optional[str] = Query(default=None, description="Destination canonical asset_id"),
    db: AsyncSession = Depends(get_db),
) -> RouteSegmentOut:
    service = GridService(db)
    return await service.compute_feeder_route(
        feeder_code=feeder_code,
        from_asset_id=from_asset_id,
        to_asset_id=to_asset_id,
    )
