from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: Dict[str, Any]
    properties: Dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)
    features: List[GeoJSONFeature]


class SearchResultItem(BaseModel):
    kind: Literal["ASSET", "SUBSTATION", "FEEDER", "TRANSFORMER", "GEOGRAPHY"]
    id: str
    label: str
    sublabel: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    asset_id: Optional[str] = None
    asset_type: Optional[str] = None
    source: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None


class UnifiedSearchResponse(BaseModel):
    query: str
    count: int
    results: List[SearchResultItem]


class RouteSegmentOut(BaseModel):
    route_id: str
    name: str
    from_asset_id: str
    to_asset_id: str
    feeder_code: Optional[str] = None
    substation_code: Optional[str] = None
    voltage_level: Optional[str] = None
    distance_meters: float
    hops: List[str]
    geojson: GeoJSONFeatureCollection
    computed_at: datetime
