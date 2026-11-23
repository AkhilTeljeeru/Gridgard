from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_db
from app.schemas.grid import GeoJSONFeatureCollection
from app.services.grid_service import GridService

router = APIRouter(prefix="/grid", tags=["Grid GeoJSON Layers"])


@router.get(
    "/substations",
    response_model=GeoJSONFeatureCollection,
    summary="Substations GeoJSON FeatureCollection",
)
async def get_substations_layer(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> GeoJSONFeatureCollection:
    service = GridService(db)
    return await service.get_substations_geojson(
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get(
    "/feeders",
    response_model=GeoJSONFeatureCollection,
    summary="Feeders LineString GeoJSON FeatureCollection",
)
async def get_feeders_layer(
    substation_id: Optional[int] = Query(default=None, gt=0),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> GeoJSONFeatureCollection:
    service = GridService(db)
    return await service.get_feeders_geojson(
        substation_id=substation_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get(
    "/transformers",
    response_model=GeoJSONFeatureCollection,
    summary="Distribution Transformers GeoJSON FeatureCollection",
)
async def get_transformers_layer(
    feeder_id: Optional[int] = Query(default=None, gt=0),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> GeoJSONFeatureCollection:
    service = GridService(db)
    return await service.get_transformers_geojson(
        feeder_id=feeder_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get(
    "/switches",
    response_model=GeoJSONFeatureCollection,
    summary="Switches, Sectionalizers & Circuit Breakers GeoJSON FeatureCollection",
)
async def get_switches_layer(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> GeoJSONFeatureCollection:
    service = GridService(db)
    return await service.get_switches_geojson(
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get(
    "/faults",
    response_model=GeoJSONFeatureCollection,
    summary="Grid Faults GeoJSON FeatureCollection",
)
async def get_faults_layer(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    severity: Optional[str] = Query(default=None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> GeoJSONFeatureCollection:
    service = GridService(db)
    return await service.get_faults_geojson(
        status_filter=status_filter,
        severity=severity,
        limit=pagination.limit,
        offset=pagination.offset,
    )
