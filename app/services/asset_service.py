from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import gis_cache
from app.gis.serializers import (
    build_feature_collection,
    geometry_to_geojson_dict,
    serialize_asset_feature,
)
from app.models.grid import UtilityAsset
from app.repositories.asset_repo import AssetRepository
from app.repositories.geography_repo import GeographyRepository
from app.schemas.asset import (
    AssetCreate,
    AssetDetailResponse,
    AssetOut,
    AssetUpdate,
    NearbyAssetsResponse,
)
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.utils.validators import build_and_validate_geometry, validate_bbox_string


def _asset_to_schema(
    record: UtilityAsset,
    distance_meters: Optional[float] = None,
) -> AssetOut:
    geom_dict = geometry_to_geojson_dict(record.geometry)
    return AssetOut(
        id=record.id,
        asset_id=record.asset_id,
        canonical_id=record.asset_id,
        asset_name=record.asset_name,
        asset_type=record.asset_type,
        latitude=record.latitude,
        longitude=record.longitude,
        voltage_level=record.voltage_level,
        operational_status=record.operational_status,
        installation_date=record.installation_date,
        last_maintenance=record.last_maintenance,
        state_id=record.state_id,
        district_id=record.district_id,
        city_id=record.city_id,
        area_id=record.area_id,
        feeder_id=record.feeder_id,
        substation_id=record.substation_id,
        substation_code=record.substation_code,
        feeder_code=record.feeder_code,
        operator=record.operator,
        rated_capacity_kva=float(record.rated_capacity_kva)
        if record.rated_capacity_kva is not None
        else None,
        source=record.source,
        geometry=geom_dict,
        distance_meters=round(float(distance_meters), 2)
        if distance_meters is not None
        else None,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _build_cross_module_references(record: UtilityAsset) -> Dict[str, Any]:
    """Canonical cross-module navigation links anchored on asset_id."""
    cid = record.asset_id
    return {
        "canonical_id": cid,
        "knowledge_graph_node_id": cid,
        "map_focus_asset_id": cid,
        "event_reconstruction_filter": f"/events?asset_id={cid}",
        "what_if_simulator_target": record.feeder_code or cid,
        "governance_decision_scope": cid,
        "audit_log_entity_id": cid,
        "substation_code": record.substation_code or "Not available",
        "feeder_code": record.feeder_code or "Not available",
    }


class AssetService:
    """Service layer enforcing GIS validation, geographic hierarchy integrity, and cache invalidation."""

    def __init__(self, session: AsyncSession) -> None:
        self.repo = AssetRepository(session)
        self.geo_repo = GeographyRepository(session)

    async def list_assets(
        self,
        *,
        state: Optional[str] = None,
        state_id: Optional[int] = None,
        district: Optional[str] = None,
        district_id: Optional[int] = None,
        city: Optional[str] = None,
        city_id: Optional[int] = None,
        area: Optional[str] = None,
        area_id: Optional[int] = None,
        asset_type: Optional[str] = None,
        status_filter: Optional[str] = None,
        voltage: Optional[str] = None,
        bbox: Optional[str] = None,
        spatial_area_id: Optional[int] = None,
        spatial_district_id: Optional[int] = None,
        include_geojson: bool = True,
        limit: int = 100,
        offset: int = 0,
    ) -> PaginatedResponse[AssetOut]:
        parsed_bbox = None
        if bbox:
            try:
                parsed_bbox = validate_bbox_string(bbox)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(exc),
                ) from exc

        cache_key = (
            f"assets:list:{state}:{state_id}:{district}:{district_id}:"
            f"{city}:{city_id}:{area}:{area_id}:{asset_type}:{status_filter}:"
            f"{voltage}:{bbox}:{spatial_area_id}:{spatial_district_id}:"
            f"{include_geojson}:{limit}:{offset}"
        )
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        records, total = await self.repo.list_filtered(
            state=state,
            state_id=state_id,
            district=district,
            district_id=district_id,
            city=city,
            city_id=city_id,
            area=area,
            area_id=area_id,
            asset_type=asset_type,
            status=status_filter,
            voltage=voltage,
            bbox=parsed_bbox,
            spatial_area_id=spatial_area_id,
            spatial_district_id=spatial_district_id,
            limit=limit,
            offset=offset,
        )

        items = [_asset_to_schema(rec) for rec in records]
        geojson_payload = None
        if include_geojson:
            features = [serialize_asset_feature(rec) for rec in records]
            geojson_payload = build_feature_collection(
                features,
                metadata={"total": total, "limit": limit, "offset": offset},
            ).model_dump()

        response = PaginatedResponse[AssetOut](
            meta=PaginationMeta(
                total=total,
                limit=limit,
                offset=offset,
                has_more=(offset + len(items)) < total,
            ),
            items=items,
            geojson=geojson_payload,
        )
        await gis_cache.set(cache_key, response, ttl_seconds=30)
        return response

    async def find_nearby_assets(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: float,
        limit: int = 50,
    ) -> NearbyAssetsResponse:
        rows = await self.repo.find_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_meters=radius_meters,
            limit=limit,
        )
        assets = [_asset_to_schema(rec, distance_meters=dist) for rec, dist in rows]
        features = [
            serialize_asset_feature(rec, distance_meters=dist) for rec, dist in rows
        ]
        collection = build_feature_collection(
            features,
            metadata={
                "center": [longitude, latitude],
                "radius_meters": radius_meters,
            },
        )
        return NearbyAssetsResponse(
            center_latitude=latitude,
            center_longitude=longitude,
            radius_meters=radius_meters,
            count=len(assets),
            assets=assets,
            geojson=collection.model_dump(),
        )

    async def get_asset_detail(self, asset_id: str) -> AssetDetailResponse:
        record = await self.repo.get_by_asset_id(asset_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with canonical asset_id '{asset_id}' not found.",
            )
        feature = serialize_asset_feature(record)
        return AssetDetailResponse(
            asset=_asset_to_schema(record),
            geojson=feature.model_dump(),
            module_references=_build_cross_module_references(record),
        )

    async def create_asset(self, payload: AssetCreate) -> AssetDetailResponse:
        existing = await self.repo.get_by_asset_id(payload.asset_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Asset with canonical asset_id '{payload.asset_id}' already exists.",
            )

        geo_ok, geo_err = await self.geo_repo.verify_hierarchy_ids(
            state_id=payload.state_id,
            district_id=payload.district_id,
            city_id=payload.city_id,
            area_id=payload.area_id,
        )
        if not geo_ok:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=geo_err,
            )

        topo_ok, topo_err = await self.repo.verify_topology_refs(
            substation_id=payload.substation_id,
            feeder_id=payload.feeder_id,
        )
        if not topo_ok:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=topo_err,
            )

        try:
            shapely_geom = build_and_validate_geometry(
                payload.latitude,
                payload.longitude,
                payload.geometry,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

        record = await self.repo.create(payload, shapely_geom)
        await self._invalidate_caches()
        return AssetDetailResponse(
            asset=_asset_to_schema(record),
            geojson=serialize_asset_feature(record).model_dump(),
            module_references=_build_cross_module_references(record),
        )

    async def update_asset(
        self,
        asset_id: str,
        payload: AssetUpdate,
    ) -> AssetDetailResponse:
        record = await self.repo.get_by_asset_id(asset_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with canonical asset_id '{asset_id}' not found.",
            )

        target_state_id = payload.state_id if payload.state_id is not None else record.state_id
        target_district_id = (
            payload.district_id if payload.district_id is not None else record.district_id
        )
        target_city_id = payload.city_id if payload.city_id is not None else record.city_id
        target_area_id = payload.area_id if payload.area_id is not None else record.area_id

        if any(
            v is not None
            for v in (
                payload.state_id,
                payload.district_id,
                payload.city_id,
                payload.area_id,
            )
        ):
            geo_ok, geo_err = await self.geo_repo.verify_hierarchy_ids(
                state_id=target_state_id,
                district_id=target_district_id,
                city_id=target_city_id,
                area_id=target_area_id,
            )
            if not geo_ok:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=geo_err,
                )

        if payload.substation_id is not None or payload.feeder_id is not None:
            topo_ok, topo_err = await self.repo.verify_topology_refs(
                substation_id=payload.substation_id,
                feeder_id=payload.feeder_id,
            )
            if not topo_ok:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=topo_err,
                )

        shapely_geom = None
        if payload.latitude is not None and payload.longitude is not None:
            try:
                shapely_geom = build_and_validate_geometry(
                    payload.latitude,
                    payload.longitude,
                    payload.geometry,
                )
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(exc),
                ) from exc

        updated = await self.repo.update(record, payload, shapely_geom=shapely_geom)
        await self._invalidate_caches()
        return AssetDetailResponse(
            asset=_asset_to_schema(updated),
            geojson=serialize_asset_feature(updated).model_dump(),
            module_references=_build_cross_module_references(updated),
        )

    async def delete_asset(self, asset_id: str) -> Dict[str, str]:
        record = await self.repo.get_by_asset_id(asset_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with canonical asset_id '{asset_id}' not found.",
            )
        await self.repo.delete(record)
        await self._invalidate_caches()
        return {
            "status": "deleted",
            "asset_id": asset_id,
            "message": f"Asset '{asset_id}' removed from PostGIS registry.",
        }

    async def _invalidate_caches(self) -> None:
        await gis_cache.invalidate_prefix("assets:")
        await gis_cache.invalidate_prefix("grid:")
        await gis_cache.invalidate_prefix("search:")
