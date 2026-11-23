from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.validators import (
    build_and_validate_geometry,
    validate_canonical_id,
    validate_coordinates,
    validate_voltage_level,
)

AssetTypeLiteral = Literal[
    "SUBSTATION",
    "FEEDER",
    "TRANSFORMER",
    "CIRCUIT_BREAKER",
    "SECTIONALIZER",
    "RECLOSER",
    "SWITCH",
    "PLANT",
    "GENERATOR",
    "TOWER",
    "POLE",
    "CAPACITOR_BANK",
    "LOAD_POINT",
]

AssetStatusLiteral = Literal[
    "ACTIVE",
    "HEALTHY",
    "WARNING",
    "FAULTED",
    "MAINTENANCE",
    "DE_ENERGIZED",
    "OFFLINE",
    "UNKNOWN",
]


class AssetBase(BaseModel):
    asset_id: str = Field(..., min_length=3, max_length=100, description="Canonical unique asset ID")
    asset_name: str = Field(..., min_length=2, max_length=200)
    asset_type: str = Field(..., min_length=2, max_length=60)
    latitude: float
    longitude: float
    geometry: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional GeoJSON geometry; defaults to Point(longitude, latitude)",
    )
    voltage_level: Optional[str] = Field(default=None, max_length=50)
    operational_status: str = Field(default="ACTIVE", max_length=40)
    installation_date: Optional[date] = None
    last_maintenance: Optional[date] = None
    state_id: int = Field(..., gt=0)
    district_id: int = Field(..., gt=0)
    city_id: int = Field(..., gt=0)
    area_id: int = Field(..., gt=0)
    feeder_id: Optional[int] = Field(default=None, gt=0)
    substation_id: Optional[int] = Field(default=None, gt=0)
    substation_code: Optional[str] = None
    feeder_code: Optional[str] = None
    operator: Optional[str] = None
    rated_capacity_kva: Optional[float] = Field(default=None, ge=0)
    source: str = Field(default="UTILITY", max_length=20)
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("asset_id")
    @classmethod
    def check_asset_id(cls, value: str) -> str:
        return validate_canonical_id(value)

    @field_validator("voltage_level")
    @classmethod
    def check_voltage(cls, value: Optional[str]) -> Optional[str]:
        return validate_voltage_level(value)

    @model_validator(mode="after")
    def check_spatial_integrity(self) -> "AssetBase":
        lat, lon = validate_coordinates(self.latitude, self.longitude)
        self.latitude = lat
        self.longitude = lon
        build_and_validate_geometry(lat, lon, self.geometry)
        return self


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    asset_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    asset_type: Optional[str] = Field(default=None, min_length=2, max_length=60)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geometry: Optional[Dict[str, Any]] = None
    voltage_level: Optional[str] = Field(default=None, max_length=50)
    operational_status: Optional[str] = Field(default=None, max_length=40)
    installation_date: Optional[date] = None
    last_maintenance: Optional[date] = None
    state_id: Optional[int] = Field(default=None, gt=0)
    district_id: Optional[int] = Field(default=None, gt=0)
    city_id: Optional[int] = Field(default=None, gt=0)
    area_id: Optional[int] = Field(default=None, gt=0)
    feeder_id: Optional[int] = Field(default=None, gt=0)
    substation_id: Optional[int] = Field(default=None, gt=0)
    substation_code: Optional[str] = None
    feeder_code: Optional[str] = None
    operator: Optional[str] = None
    rated_capacity_kva: Optional[float] = Field(default=None, ge=0)
    source: Optional[str] = Field(default=None, max_length=20)
    extra_metadata: Optional[Dict[str, Any]] = None

    @field_validator("voltage_level")
    @classmethod
    def check_voltage(cls, value: Optional[str]) -> Optional[str]:
        return validate_voltage_level(value)

    @model_validator(mode="after")
    def check_partial_coords(self) -> "AssetUpdate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together when updating location.")
        if self.latitude is not None and self.longitude is not None:
            lat, lon = validate_coordinates(self.latitude, self.longitude)
            self.latitude = lat
            self.longitude = lon
            build_and_validate_geometry(lat, lon, self.geometry)
        elif self.geometry is not None:
            raise ValueError("latitude and longitude must accompany custom geometry updates.")
        return self


class AssetOut(BaseModel):
    id: int
    asset_id: str
    canonical_id: str
    asset_name: str
    asset_type: str
    latitude: float
    longitude: float
    voltage_level: Optional[str] = None
    operational_status: str
    installation_date: Optional[date] = None
    last_maintenance: Optional[date] = None
    state_id: int
    district_id: int
    city_id: int
    area_id: int
    feeder_id: Optional[int] = None
    substation_id: Optional[int] = None
    substation_code: Optional[str] = None
    feeder_code: Optional[str] = None
    operator: Optional[str] = None
    rated_capacity_kva: Optional[float] = None
    source: str
    geometry: Dict[str, Any]
    distance_meters: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AssetDetailResponse(BaseModel):
    asset: AssetOut
    geojson: Dict[str, Any]
    module_references: Dict[str, Any]


class NearbyAssetsResponse(BaseModel):
    center_latitude: float
    center_longitude: float
    radius_meters: float
    count: int
    assets: List[AssetOut]
    geojson: Dict[str, Any]
