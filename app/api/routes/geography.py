from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.geography import AreaOut, CityOut, CountryOut, DistrictOut, StateOut
from app.services.geography_service import GeographyService

router = APIRouter(prefix="/geography", tags=["Geography"])


@router.get(
    "/countries",
    response_model=List[CountryOut],
    summary="List Supported Countries",
)
async def list_countries(db: AsyncSession = Depends(get_db)) -> List[CountryOut]:
    service = GeographyService(db)
    return await service.get_countries()


@router.get(
    "/states",
    response_model=List[StateOut],
    summary="List States (Filtered by country_id)",
)
async def list_states(
    country_id: Optional[int] = Query(default=None, gt=0),
    db: AsyncSession = Depends(get_db),
) -> List[StateOut]:
    service = GeographyService(db)
    return await service.get_states(country_id=country_id)


@router.get(
    "/districts",
    response_model=List[DistrictOut],
    summary="List Districts (Filtered by state_id)",
)
async def list_districts(
    state_id: Optional[int] = Query(default=None, gt=0),
    db: AsyncSession = Depends(get_db),
) -> List[DistrictOut]:
    service = GeographyService(db)
    return await service.get_districts(state_id=state_id)


@router.get(
    "/cities",
    response_model=List[CityOut],
    summary="List Cities / Towns (Filtered by district_id)",
)
async def list_cities(
    district_id: Optional[int] = Query(default=None, gt=0),
    db: AsyncSession = Depends(get_db),
) -> List[CityOut]:
    service = GeographyService(db)
    return await service.get_cities(district_id=district_id)


@router.get(
    "/areas",
    response_model=List[AreaOut],
    summary="List Areas & Pincodes (Filtered by city_id or pincode)",
)
async def list_areas(
    city_id: Optional[int] = Query(default=None, gt=0),
    pincode: Optional[str] = Query(default=None, max_length=16),
    db: AsyncSession = Depends(get_db),
) -> List[AreaOut]:
    service = GeographyService(db)
    return await service.get_areas(city_id=city_id, pincode=pincode)
