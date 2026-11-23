from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class CountryOut(BaseModel):
    id: int
    name: str
    iso_code: str

    model_config = ConfigDict(from_attributes=True)


class StateOut(BaseModel):
    id: int
    country_id: int
    name: str
    state_code: str
    geometry: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class DistrictOut(BaseModel):
    id: int
    state_id: int
    name: str
    geometry: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class CityOut(BaseModel):
    id: int
    district_id: int
    name: str
    geometry: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class AreaOut(BaseModel):
    id: int
    city_id: int
    name: str
    pincode: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
