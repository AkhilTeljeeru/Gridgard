from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import gis_cache
from app.gis.serializers import geometry_to_geojson_dict
from app.repositories.geography_repo import GeographyRepository
from app.schemas.geography import (
    AreaOut,
    CityOut,
    CountryOut,
    DistrictOut,
    StateOut,
)


class GeographyService:
    """Business logic and cached serialization for cascading geographic filters."""

    def __init__(self, session: AsyncSession) -> None:
        self.repo = GeographyRepository(session)

    async def get_countries(self) -> List[CountryOut]:
        cache_key = "geo:countries"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_countries()
        result = [CountryOut.model_validate(row) for row in rows]
        await gis_cache.set(cache_key, result, ttl_seconds=300)
        return result

    async def get_states(self, country_id: Optional[int] = None) -> List[StateOut]:
        cache_key = f"geo:states:{country_id or 'all'}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_states(country_id=country_id)
        result = [
            StateOut(
                id=row.id,
                country_id=row.country_id,
                name=row.name,
                state_code=row.state_code,
                geometry=geometry_to_geojson_dict(row.geometry)
                if row.geometry is not None
                else None,
            )
            for row in rows
        ]
        await gis_cache.set(cache_key, result, ttl_seconds=300)
        return result

    async def get_districts(self, state_id: Optional[int] = None) -> List[DistrictOut]:
        cache_key = f"geo:districts:{state_id or 'all'}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_districts(state_id=state_id)
        result = [
            DistrictOut(
                id=row.id,
                state_id=row.state_id,
                name=row.name,
                geometry=geometry_to_geojson_dict(row.geometry)
                if row.geometry is not None
                else None,
            )
            for row in rows
        ]
        await gis_cache.set(cache_key, result, ttl_seconds=300)
        return result

    async def get_cities(self, district_id: Optional[int] = None) -> List[CityOut]:
        cache_key = f"geo:cities:{district_id or 'all'}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_cities(district_id=district_id)
        result = [
            CityOut(
                id=row.id,
                district_id=row.district_id,
                name=row.name,
                geometry=geometry_to_geojson_dict(row.geometry)
                if row.geometry is not None
                else None,
            )
            for row in rows
        ]
        await gis_cache.set(cache_key, result, ttl_seconds=300)
        return result

    async def get_areas(
        self,
        city_id: Optional[int] = None,
        pincode: Optional[str] = None,
    ) -> List[AreaOut]:
        cache_key = f"geo:areas:{city_id or 'all'}:{pincode or 'all'}"
        cached = await gis_cache.get(cache_key)
        if cached is not None:
            return cached

        rows = await self.repo.list_areas(city_id=city_id, pincode=pincode)
        result = [
            AreaOut(
                id=row.id,
                city_id=row.city_id,
                name=row.name,
                pincode=row.pincode,
                geometry=geometry_to_geojson_dict(row.geometry)
                if row.geometry is not None
                else None,
            )
            for row in rows
        ]
        await gis_cache.set(cache_key, result, ttl_seconds=300)
        return result
