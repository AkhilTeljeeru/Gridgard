from typing import Dict, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_db, require_roles
from app.core.security import AuthenticatedUser, UserRole
from app.schemas.asset import (
    AssetCreate,
    AssetDetailResponse,
    AssetOut,
    AssetUpdate,
    NearbyAssetsResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.asset_service import AssetService

router = APIRouter(prefix="/assets", tags=["Utility Assets"])


@router.get(
    "",
    response_model=PaginatedResponse[AssetOut],
    summary="Query Electrical Utility Assets with Geographic, Spatial & Attribute Filters",
)
async def list_assets(
    state: Optional[str] = Query(default=None, description="Filter by state name"),
    state_id: Optional[int] = Query(default=None, gt=0),
    district: Optional[str] = Query(default=None, description="Filter by district name"),
    district_id: Optional[int] = Query(default=None, gt=0),
    city: Optional[str] = Query(default=None, description="Filter by city name"),
    city_id: Optional[int] = Query(default=None, gt=0),
    area: Optional[str] = Query(default=None, description="Filter by area name"),
    area_id: Optional[int] = Query(default=None, gt=0),
    asset_type: Optional[str] = Query(
        default=None,
        description="SUBSTATION | FEEDER | TRANSFORMER | CIRCUIT_BREAKER | SECTIONALIZER | SWITCH",
    ),
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="ACTIVE | HEALTHY | WARNING | FAULTED | MAINTENANCE",
    ),
    voltage: Optional[str] = Query(default=None, description="e.g. '11 kV', '33/11 kV', '132/33 kV'"),
    bbox: Optional[str] = Query(
        default=None,
        description="Bounding box 'south,west,north,east' for ST_Intersects spatial viewport filtering",
    ),
    spatial_area_id: Optional[int] = Query(
        default=None,
        gt=0,
        description="PostGIS ST_Within polygon filter against areas.id",
    ),
    spatial_district_id: Optional[int] = Query(
        default=None,
        gt=0,
        description="PostGIS ST_Intersects polygon filter against districts.id",
    ),
    include_geojson: bool = Query(default=True),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AssetOut]:
    service = AssetService(db)
    return await service.list_assets(
        state=state,
        state_id=state_id,
        district=district,
        district_id=district_id,
        city=city,
        city_id=city_id,
        area=area,
        area_id=area_id,
        asset_type=asset_type,
        status_filter=status_filter,
        voltage=voltage,
        bbox=bbox,
        spatial_area_id=spatial_area_id,
        spatial_district_id=spatial_district_id,
        include_geojson=include_geojson,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get(
    "/nearby",
    response_model=NearbyAssetsResponse,
    summary="Find Nearest Utility Assets Within Radius (PostGIS ST_DWithin Spheroidal Meters)",
)
async def find_nearby_assets(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius: float = Query(default=2000.0, gt=0.0, le=200000.0, description="Search radius in meters"),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> NearbyAssetsResponse:
    service = AssetService(db)
    return await service.find_nearby_assets(
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius,
        limit=limit,
    )


@router.get(
    "/{asset_id}",
    response_model=AssetDetailResponse,
    summary="Retrieve Asset Details, GeoJSON Feature & Canonical Cross-Module Links",
)
async def get_asset_by_id(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
) -> AssetDetailResponse:
    service = AssetService(db)
    return await service.get_asset_detail(asset_id)


@router.post(
    "",
    response_model=AssetDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Utility Asset (Requires Administrator, Utility Manager, or Field Engineer)",
)
async def create_asset(
    payload: AssetCreate,
    db: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.UTILITY_MANAGER,
            UserRole.FIELD_ENGINEER,
        )
    ),
) -> AssetDetailResponse:
    service = AssetService(db)
    return await service.create_asset(payload)


@router.put(
    "/{asset_id}",
    response_model=AssetDetailResponse,
    summary="Update Utility Asset (Requires Administrator, Utility Manager, or Field Engineer)",
)
async def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.UTILITY_MANAGER,
            UserRole.FIELD_ENGINEER,
        )
    ),
) -> AssetDetailResponse:
    service = AssetService(db)
    return await service.update_asset(asset_id, payload)


@router.delete(
    "/{asset_id}",
    response_model=Dict[str, str],
    summary="Delete Utility Asset (Requires Administrator or Utility Manager)",
)
async def delete_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.UTILITY_MANAGER,
        )
    ),
) -> Dict[str, str]:
    service = AssetService(db)
    return await service.delete_asset(asset_id)
