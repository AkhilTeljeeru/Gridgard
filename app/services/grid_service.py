from datetime import datetime, timezone
import math
from typing import List, Optional
from fastapi import HTTPException, status
from shapely.geometry import LineString, mapping
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import gis_cache
from app.gis.serializers import (
    build_feature_collection,
    format_missing_value,
    geometry_to_geojson_dict,
    serialize_asset_feature,
)
from app.repositories.grid_repo import GridRepository
from app.schemas.grid import (
    GeoJSONFeature,
    GeoJSONFeatureCollection,
    RouteSegmentOut,
    SearchResultItem,
    UnifiedSearchResponse,
)


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_m = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    return 2.0 * earth_radius_m * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


class GridService:
    """Service layer for GeoJSON grid layers, unified search, and electrical corridor routing."""

    def __init__(self, session: AsyncSession) -> None:
        self.repo = GridRepository(session)

    async def get_substations_geojson(
        self,
        limit: int = 500,
        offset: int = 0,
    ) -> GeoJSONFeatureCollection:
        cache_key = f"grid:substations:{limit}:{offset}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_substations(limit=limit, offset=offset)
        features = [
            GeoJSONFeature(
                id=row.substation_code,
                geometry=geometry_to_geojson_dict(row.geometry),
                properties={
                    "id": row.substation_code,
                    "asset_id": row.substation_code,
                    "canonical_id": row.substation_code,
                    "asset_type": "SUBSTATION",
                    "name": row.name,
                    "capacity_kva": float(row.capacity) if row.capacity is not None else None,
                    "voltage_level": format_missing_value(row.voltage_level),
                    "operator": format_missing_value(row.operator),
                    "status": row.status,
                    "source": "DEMO",
                },
            )
            for row in rows
        ]
        collection = build_feature_collection(
            features,
            metadata={"layer": "substations", "srid": 4326},
        )
        await gis_cache.set(cache_key, collection, ttl_seconds=60)
        return collection

    async def get_feeders_geojson(
        self,
        substation_id: Optional[int] = None,
        limit: int = 500,
        offset: int = 0,
    ) -> GeoJSONFeatureCollection:
        cache_key = f"grid:feeders:{substation_id}:{limit}:{offset}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_feeders(
            substation_id=substation_id,
            limit=limit,
            offset=offset,
        )
        features = [
            GeoJSONFeature(
                id=row.feeder_code,
                geometry=geometry_to_geojson_dict(row.geometry),
                properties={
                    "id": row.feeder_code,
                    "asset_id": row.feeder_code,
                    "canonical_id": row.feeder_code,
                    "asset_type": "FEEDER",
                    "name": row.feeder_name,
                    "substation_id": row.substation_id,
                    "voltage_level": format_missing_value(row.voltage_level),
                    "operator": format_missing_value(row.operator),
                    "status": row.status,
                    "source": "DEMO",
                },
            )
            for row in rows
        ]
        collection = build_feature_collection(
            features,
            metadata={"layer": "feeders", "srid": 4326},
        )
        await gis_cache.set(cache_key, collection, ttl_seconds=60)
        return collection

    async def get_transformers_geojson(
        self,
        feeder_id: Optional[int] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> GeoJSONFeatureCollection:
        cache_key = f"grid:transformers:{feeder_id}:{limit}:{offset}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_transformers(
            feeder_id=feeder_id,
            limit=limit,
            offset=offset,
        )
        features = [
            GeoJSONFeature(
                id=row.transformer_code,
                geometry=geometry_to_geojson_dict(row.geometry),
                properties={
                    "id": row.transformer_code,
                    "asset_id": row.transformer_code,
                    "canonical_id": row.transformer_code,
                    "asset_type": "TRANSFORMER",
                    "name": format_missing_value(row.name),
                    "feeder_id": row.feeder_id,
                    "capacity_kva": float(row.capacity) if row.capacity is not None else None,
                    "voltage_level": format_missing_value(row.voltage_level),
                    "status": row.status,
                    "source": "DEMO",
                },
            )
            for row in rows
        ]
        collection = build_feature_collection(
            features,
            metadata={"layer": "transformers", "srid": 4326},
        )
        await gis_cache.set(cache_key, collection, ttl_seconds=60)
        return collection

    async def get_switches_geojson(
        self,
        limit: int = 1000,
        offset: int = 0,
    ) -> GeoJSONFeatureCollection:
        cache_key = f"grid:switches:{limit}:{offset}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_switches(limit=limit, offset=offset)
        features = [serialize_asset_feature(row) for row in rows]
        collection = build_feature_collection(
            features,
            metadata={"layer": "switches", "srid": 4326},
        )
        await gis_cache.set(cache_key, collection, ttl_seconds=60)
        return collection

    async def get_faults_geojson(
        self,
        status_filter: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 500,
        offset: int = 0,
    ) -> GeoJSONFeatureCollection:
        cache_key = f"grid:faults:{status_filter}:{severity}:{limit}:{offset}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_faults(
            status=status_filter,
            severity=severity,
            limit=limit,
            offset=offset,
        )
        features = [
            GeoJSONFeature(
                id=row.fault_id,
                geometry=geometry_to_geojson_dict(row.geometry),
                properties={
                    "id": row.fault_id,
                    "fault_id": row.fault_id,
                    "asset_id": row.asset_id,
                    "canonical_id": row.asset_id,
                    "severity": row.severity,
                    "fault_type": row.fault_type,
                    "detected_time": row.detected_time.isoformat(),
                    "resolved_time": row.resolved_time.isoformat()
                    if row.resolved_time
                    else None,
                    "status": row.status,
                    "radius_meters": row.radius_meters,
                    "related_event_id": row.related_event_id,
                    "description": row.description,
                    "source": row.source,
                },
            )
            for row in rows
        ]
        collection = build_feature_collection(
            features,
            metadata={"layer": "faults", "srid": 4326},
        )
        await gis_cache.set(cache_key, collection, ttl_seconds=30)
        return collection

    async def unified_search(self, query: str, limit: int = 25) -> UnifiedSearchResponse:
        cleaned = query.strip()
        cache_key = f"search:{cleaned.lower()}:{limit}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        raw = await self.repo.unified_search(cleaned, limit=limit)
        results: List[SearchResultItem] = []

        for asset in raw["assets"]:
            results.append(
                SearchResultItem(
                    kind="ASSET",
                    id=asset.asset_id,
                    label=asset.asset_name,
                    sublabel=f"{asset.asset_type} • {asset.asset_id} • {asset.operational_status}",
                    latitude=asset.latitude,
                    longitude=asset.longitude,
                    asset_id=asset.asset_id,
                    asset_type=asset.asset_type,
                    source=asset.source,
                    geometry=geometry_to_geojson_dict(asset.geometry),
                )
            )

        for sub in raw["substations"]:
            results.append(
                SearchResultItem(
                    kind="SUBSTATION",
                    id=sub.substation_code,
                    label=sub.name,
                    sublabel=f"Substation • {sub.substation_code} • {format_missing_value(sub.voltage_level)}",
                    latitude=sub.latitude,
                    longitude=sub.longitude,
                    asset_id=sub.substation_code,
                    asset_type="SUBSTATION",
                    source="DEMO",
                    geometry=geometry_to_geojson_dict(sub.geometry),
                )
            )

        for fdr in raw["feeders"]:
            results.append(
                SearchResultItem(
                    kind="FEEDER",
                    id=fdr.feeder_code,
                    label=fdr.feeder_name,
                    sublabel=f"Feeder • {fdr.feeder_code} • {fdr.status}",
                    asset_id=fdr.feeder_code,
                    asset_type="FEEDER",
                    source="DEMO",
                    geometry=geometry_to_geojson_dict(fdr.geometry),
                )
            )

        for tx in raw["transformers"]:
            results.append(
                SearchResultItem(
                    kind="TRANSFORMER",
                    id=tx.transformer_code,
                    label=tx.name or tx.transformer_code,
                    sublabel=f"Transformer • {tx.transformer_code} • {tx.status}",
                    latitude=tx.latitude,
                    longitude=tx.longitude,
                    asset_id=tx.transformer_code,
                    asset_type="TRANSFORMER",
                    source="DEMO",
                    geometry=geometry_to_geojson_dict(tx.geometry),
                )
            )

        for area in raw["areas"]:
            pin_note = f"PIN {area.pincode}" if area.pincode else "Area"
            results.append(
                SearchResultItem(
                    kind="GEOGRAPHY",
                    id=f"AREA-{area.id}",
                    label=area.name,
                    sublabel=f"Area • {pin_note}",
                    geometry=geometry_to_geojson_dict(area.geometry)
                    if area.geometry is not None
                    else None,
                )
            )

        for city in raw["cities"]:
            results.append(
                SearchResultItem(
                    kind="GEOGRAPHY",
                    id=f"CITY-{city.id}",
                    label=city.name,
                    sublabel="City / Town",
                    geometry=geometry_to_geojson_dict(city.geometry)
                    if city.geometry is not None
                    else None,
                )
            )

        for dist in raw["districts"]:
            results.append(
                SearchResultItem(
                    kind="GEOGRAPHY",
                    id=f"DISTRICT-{dist.id}",
                    label=dist.name,
                    sublabel="District",
                    geometry=geometry_to_geojson_dict(dist.geometry)
                    if dist.geometry is not None
                    else None,
                )
            )

        for st in raw["states"]:
            results.append(
                SearchResultItem(
                    kind="GEOGRAPHY",
                    id=f"STATE-{st.id}",
                    label=st.name,
                    sublabel=f"State ({st.state_code})",
                    geometry=geometry_to_geojson_dict(st.geometry)
                    if st.geometry is not None
                    else None,
                )
            )

        trimmed = results[:limit]
        response = UnifiedSearchResponse(
            query=cleaned,
            count=len(trimmed),
            results=trimmed,
        )
        await gis_cache.set(cache_key, response, ttl_seconds=30)
        return response

    async def compute_feeder_route(
        self,
        *,
        feeder_code: Optional[str] = None,
        from_asset_id: Optional[str] = None,
        to_asset_id: Optional[str] = None,
    ) -> RouteSegmentOut:
        if not any([feeder_code, from_asset_id, to_asset_id]):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Provide at least one of feeder_code, from_asset_id, or to_asset_id.",
            )

        feeder, from_asset, to_asset, corridor_assets = (
            await self.repo.get_feeder_route_context(
                feeder_code=feeder_code,
                from_asset_id=from_asset_id,
                to_asset_id=to_asset_id,
            )
        )

        ordered_points = []
        hops: List[str] = []

        if from_asset is not None:
            ordered_points.append((from_asset.longitude, from_asset.latitude))
            hops.append(from_asset.asset_id)

        for asset in corridor_assets:
            if asset.asset_id not in hops:
                ordered_points.append((asset.longitude, asset.latitude))
                hops.append(asset.asset_id)

        if to_asset is not None and to_asset.asset_id not in hops:
            ordered_points.append((to_asset.longitude, to_asset.latitude))
            hops.append(to_asset.asset_id)

        if feeder is not None and len(ordered_points) < 2:
            fdr_geom = geometry_to_geojson_dict(feeder.geometry)
            coords = fdr_geom.get("coordinates", [])
            if len(coords) >= 2:
                ordered_points = [(float(c[0]), float(c[1])) for c in coords]
                if feeder.feeder_code not in hops:
                    hops.insert(0, feeder.feeder_code)

        if len(ordered_points) < 2:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Insufficient connected assets or feeder geometry to trace an electrical corridor route.",
            )

        line_geom = LineString(ordered_points)
        total_distance_m = sum(
            _haversine_meters(p1[1], p1[0], p2[1], p2[0])
            for p1, p2 in zip(ordered_points[:-1], ordered_points[1:])
        )

        route_id = f"ROUTE-{feeder.feeder_code if feeder else hops[0]}"
        route_name = (
            f"{feeder.feeder_name} Electrical Corridor"
            if feeder
            else f"Corridor {hops[0]} -> {hops[-1]}"
        )
        route_feature = GeoJSONFeature(
            id=route_id,
            geometry=mapping(line_geom),
            properties={
                "route_id": route_id,
                "feeder_code": feeder.feeder_code if feeder else feeder_code,
                "voltage_level": feeder.voltage_level if feeder else None,
                "distance_meters": round(total_distance_m, 2),
                "hops": hops,
            },
        )
        collection = build_feature_collection(
            [route_feature],
            metadata={"route_id": route_id, "hop_count": len(hops)},
        )

        return RouteSegmentOut(
            route_id=route_id,
            name=route_name,
            from_asset_id=hops[0],
            to_asset_id=hops[-1],
            feeder_code=feeder.feeder_code if feeder else feeder_code,
            substation_code=from_asset.substation_code if from_asset else None,
            voltage_level=feeder.voltage_level if feeder else None,
            distance_meters=round(total_distance_m, 2),
            hops=hops,
            geojson=collection,
            computed_at=datetime.now(timezone.utc),
        )
