import json
from typing import Any, Dict, Iterable, List, Optional
import geopandas as gpd
from shapely import wkb
from shapely.geometry import mapping

from app.schemas.grid import GeoJSONFeature, GeoJSONFeatureCollection


def format_missing_value(value: Any, suffix: str = "") -> Any:
    if value is None:
        return "Not available"
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed or trimmed in {"N/A", "Unknown", "Not mapped"}:
            return "Not available"
        return f"{trimmed}{suffix}" if suffix else trimmed
    return f"{value}{suffix}" if suffix else value


def geometry_to_geojson_dict(geom_value: Any) -> Dict[str, Any]:
    """Convert PostGIS WKBElement, WKT/GeoJSON string, or Shapely geometry into GeoJSON dict."""
    if geom_value is None:
        return {"type": "Point", "coordinates": [0.0, 0.0]}

    if isinstance(geom_value, dict):
        return geom_value

    if isinstance(geom_value, str):
        stripped = geom_value.strip()
        if stripped.startswith("{"):
            return json.loads(stripped)

    if hasattr(geom_value, "geom_type"):
        return mapping(geom_value)

    # GeoAlchemy2 WKBElement
    if hasattr(geom_value, "data"):
        raw_bytes = bytes(geom_value.data)
        shapely_geom = wkb.loads(raw_bytes)
        return mapping(shapely_geom)

    raise ValueError(f"Unsupported geometry representation: {type(geom_value)}")


def serialize_asset_feature(
    asset: Any,
    geom_json: Optional[Dict[str, Any]] = None,
    distance_meters: Optional[float] = None,
) -> GeoJSONFeature:
    geometry = geom_json or geometry_to_geojson_dict(asset.geometry)
    props: Dict[str, Any] = {
        "id": asset.asset_id,
        "asset_id": asset.asset_id,
        "canonical_id": asset.asset_id,
        "asset_name": asset.asset_name,
        "asset_type": asset.asset_type,
        "status": asset.operational_status,
        "operational_status": asset.operational_status,
        "voltage_level": format_missing_value(asset.voltage_level),
        "installation_date": asset.installation_date.isoformat()
        if asset.installation_date
        else "Not available",
        "last_maintenance": asset.last_maintenance.isoformat()
        if asset.last_maintenance
        else "Not available",
        "substation_id": asset.substation_id,
        "substation_code": format_missing_value(asset.substation_code),
        "feeder_id": asset.feeder_id,
        "feeder_code": format_missing_value(asset.feeder_code),
        "state_id": asset.state_id,
        "district_id": asset.district_id,
        "city_id": asset.city_id,
        "area_id": asset.area_id,
        "operator": format_missing_value(asset.operator),
        "rated_capacity_kva": float(asset.rated_capacity_kva)
        if asset.rated_capacity_kva is not None
        else None,
        "source": asset.source,
    }
    if distance_meters is not None:
        props["distance_meters"] = round(float(distance_meters), 2)

    return GeoJSONFeature(
        id=asset.asset_id,
        geometry=geometry,
        properties=props,
    )


def build_feature_collection(
    features: Iterable[GeoJSONFeature],
    metadata: Optional[Dict[str, Any]] = None,
) -> GeoJSONFeatureCollection:
    feature_list = list(features)
    return GeoJSONFeatureCollection(
        count=len(feature_list),
        metadata=metadata or {},
        features=feature_list,
    )


def features_to_geodataframe(collection: GeoJSONFeatureCollection) -> gpd.GeoDataFrame:
    """Convert GeoJSON FeatureCollection into a WGS84 GeoPandas GeoDataFrame for spatial analytics."""
    if not collection.features:
        return gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
    raw_geojson = collection.model_dump()
    return gpd.GeoDataFrame.from_features(raw_geojson["features"], crs="EPSG:4326")
