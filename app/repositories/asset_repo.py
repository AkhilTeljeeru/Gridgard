from typing import List, Optional, Tuple
from geoalchemy2.shape import from_shape
from shapely.geometry.base import BaseGeometry
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.gis.spatial_queries import (
    bbox_intersects_filter,
    distance_meters_expression,
    intersecting_district_filter,
    within_area_filter,
    within_radius_geography_filter,
)
from app.models.geography import Area, City, District, State
from app.models.grid import Feeder, Substation, UtilityAsset
from app.schemas.asset import AssetCreate, AssetUpdate


class AssetRepository:
    """Repository for UtilityAsset CRUD, filtering, spatial radius/bbox queries, and KNN lookup."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_asset_id(self, asset_id: str) -> Optional[UtilityAsset]:
        stmt = select(UtilityAsset).where(UtilityAsset.asset_id == asset_id)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def verify_topology_refs(
        self,
        substation_id: Optional[int],
        feeder_id: Optional[int],
    ) -> Tuple[bool, Optional[str]]:
        if substation_id is not None:
            sub = await self.session.get(Substation, substation_id)
            if not sub:
                return False, f"Referenced substation_id={substation_id} does not exist."
        if feeder_id is not None:
            fdr = await self.session.get(Feeder, feeder_id)
            if not fdr:
                return False, f"Referenced feeder_id={feeder_id} does not exist."
        return True, None

    async def list_filtered(
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
        status: Optional[str] = None,
        voltage: Optional[str] = None,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        spatial_area_id: Optional[int] = None,
        spatial_district_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[UtilityAsset], int]:
        stmt: Select = select(UtilityAsset)

        if state_id is not None:
            stmt = stmt.where(UtilityAsset.state_id == state_id)
        elif state:
            stmt = stmt.join(State, UtilityAsset.state_id == State.id).where(
                func.lower(State.name) == state.strip().lower()
            )

        if district_id is not None:
            stmt = stmt.where(UtilityAsset.district_id == district_id)
        elif district:
            stmt = stmt.join(District, UtilityAsset.district_id == District.id).where(
                func.lower(District.name) == district.strip().lower()
            )

        if city_id is not None:
            stmt = stmt.where(UtilityAsset.city_id == city_id)
        elif city:
            stmt = stmt.join(City, UtilityAsset.city_id == City.id).where(
                func.lower(City.name) == city.strip().lower()
            )

        if area_id is not None:
            stmt = stmt.where(UtilityAsset.area_id == area_id)
        elif area:
            stmt = stmt.join(Area, UtilityAsset.area_id == Area.id).where(
                func.lower(Area.name) == area.strip().lower()
            )

        if asset_type:
            stmt = stmt.where(
                func.upper(UtilityAsset.asset_type) == asset_type.strip().upper()
            )
        if status:
            stmt = stmt.where(
                func.upper(UtilityAsset.operational_status) == status.strip().upper()
            )
        if voltage:
            stmt = stmt.where(
                UtilityAsset.voltage_level.ilike(f"%{voltage.strip()}%")
            )

        if bbox is not None:
            south, west, north, east = bbox
            stmt = stmt.where(
                bbox_intersects_filter(UtilityAsset.geometry, south, west, north, east)
            )
        if spatial_area_id is not None:
            stmt = stmt.where(within_area_filter(UtilityAsset.geometry, spatial_area_id))
        if spatial_district_id is not None:
            stmt = stmt.where(
                intersecting_district_filter(UtilityAsset.geometry, spatial_district_id)
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int((await self.session.execute(count_stmt)).scalar_one() or 0)

        paginated_stmt = (
            stmt.order_by(UtilityAsset.asset_id.asc()).limit(limit).offset(offset)
        )
        res = await self.session.execute(paginated_stmt)
        return list(res.scalars().all()), total

    async def find_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float,
        limit: int = 50,
    ) -> List[Tuple[UtilityAsset, float]]:
        """PostGIS radius search ordered strictly by spheroidal distance ascending."""
        dist_expr = distance_meters_expression(
            UtilityAsset.geometry, latitude, longitude
        ).label("distance_meters")

        stmt = (
            select(UtilityAsset, dist_expr)
            .where(
                within_radius_geography_filter(
                    UtilityAsset.geometry, latitude, longitude, radius_meters
                )
            )
            .order_by(dist_expr.asc())
            .limit(limit)
        )
        res = await self.session.execute(stmt)
        return [(row[0], float(row[1])) for row in res.all()]

    async def find_nearest(
        self,
        latitude: float,
        longitude: float,
        limit: int = 1,
    ) -> List[Tuple[UtilityAsset, float]]:
        """Nearest asset lookup backed by PostGIS GIST KNN <-> operator."""
        dist_expr = distance_meters_expression(
            UtilityAsset.geometry, latitude, longitude
        ).label("distance_meters")
        stmt = (
            select(UtilityAsset, dist_expr)
            .order_by(UtilityAsset.geometry.op("<->")(
                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
            ))
            .limit(limit)
        )
        res = await self.session.execute(stmt)
        return [(row[0], float(row[1])) for row in res.all()]

    async def create(
        self,
        payload: AssetCreate,
        shapely_geom: BaseGeometry,
    ) -> UtilityAsset:
        record = UtilityAsset(
            asset_id=payload.asset_id,
            asset_name=payload.asset_name,
            asset_type=payload.asset_type.upper(),
            latitude=payload.latitude,
            longitude=payload.longitude,
            geometry=from_shape(shapely_geom, srid=4326),
            voltage_level=payload.voltage_level,
            operational_status=payload.operational_status.upper(),
            installation_date=payload.installation_date,
            last_maintenance=payload.last_maintenance,
            state_id=payload.state_id,
            district_id=payload.district_id,
            city_id=payload.city_id,
            area_id=payload.area_id,
            feeder_id=payload.feeder_id,
            substation_id=payload.substation_id,
            substation_code=payload.substation_code,
            feeder_code=payload.feeder_code,
            operator=payload.operator,
            rated_capacity_kva=payload.rated_capacity_kva,
            source=payload.source.upper(),
            extra_metadata=payload.extra_metadata,
        )
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def update(
        self,
        record: UtilityAsset,
        payload: AssetUpdate,
        shapely_geom: Optional[BaseGeometry] = None,
    ) -> UtilityAsset:
        update_data = payload.model_dump(exclude_unset=True)
        update_data.pop("geometry", None)
        for field, value in update_data.items():
            if field in {"asset_type", "operational_status", "source"} and isinstance(value, str):
                value = value.upper()
            setattr(record, field, value)

        if shapely_geom is not None:
            record.geometry = from_shape(shapely_geom, srid=4326)

        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def delete(self, record: UtilityAsset) -> None:
        await self.session.delete(record)
        await self.session.commit()
