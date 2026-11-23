from typing import List, Optional, Tuple
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import Area, City, Country, District, State


class GeographyRepository:
    """Data-access layer for cascading Country -> State -> District -> City -> Area queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_countries(self) -> List[Country]:
        stmt = select(Country).order_by(Country.name.asc())
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_states(self, country_id: Optional[int] = None) -> List[State]:
        stmt: Select = select(State).order_by(State.name.asc())
        if country_id is not None:
            stmt = stmt.where(State.country_id == country_id)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_districts(self, state_id: Optional[int] = None) -> List[District]:
        stmt: Select = select(District).order_by(District.name.asc())
        if state_id is not None:
            stmt = stmt.where(District.state_id == state_id)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_cities(self, district_id: Optional[int] = None) -> List[City]:
        stmt: Select = select(City).order_by(City.name.asc())
        if district_id is not None:
            stmt = stmt.where(City.district_id == district_id)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_areas(
        self,
        city_id: Optional[int] = None,
        pincode: Optional[str] = None,
    ) -> List[Area]:
        stmt: Select = select(Area).order_by(Area.name.asc())
        if city_id is not None:
            stmt = stmt.where(Area.city_id == city_id)
        if pincode:
            stmt = stmt.where(Area.pincode == pincode.strip())
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def verify_hierarchy_ids(
        self,
        state_id: int,
        district_id: int,
        city_id: int,
        area_id: int,
    ) -> Tuple[bool, Optional[str]]:
        """Confirm that state -> district -> city -> area exist and form a valid parent chain."""
        state = await self.session.get(State, state_id)
        if not state:
            return False, f"Geographic state_id={state_id} does not exist."

        district = await self.session.get(District, district_id)
        if not district or district.state_id != state_id:
            return False, (
                f"district_id={district_id} does not belong to state_id={state_id}."
            )

        city = await self.session.get(City, city_id)
        if not city or city.district_id != district_id:
            return False, (
                f"city_id={city_id} does not belong to district_id={district_id}."
            )

        area = await self.session.get(Area, area_id)
        if not area or area.city_id != city_id:
            return False, (
                f"area_id={area_id} does not belong to city_id={city_id}."
            )

        return True, None
