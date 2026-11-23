import re
from typing import Any, Dict, List, Optional, Tuple
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.geometry.base import BaseGeometry

# Valid Indian distribution/transmission voltage ratings (examples: '11 kV', '33/11 kV', '132/33 kV', '11/0.433 kV', '400 kV', '415 V')
VOLTAGE_PATTERN = re.compile(
    r"^\s*\d+(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)?\s*(?:kV|V|kv|v)\s*$"
)
CANONICAL_ID_PATTERN = re.compile(r"^[A-Za-z0-9:_-]{3,100}$")


def validate_coordinates(latitude: float, longitude: float) -> Tuple[float, float]:
    """Ensure WGS84 geographic coordinates are finite and within Earth bounds."""
    if not (-90.0 <= latitude <= 90.0):
        raise ValueError(f"Invalid latitude {latitude}. Must be between -90.0 and 90.0.")
    if not (-180.0 <= longitude <= 180.0):
        raise ValueError(f"Invalid longitude {longitude}. Must be between -180.0 and 180.0.")
    return round(float(latitude), 7), round(float(longitude), 7)


def validate_voltage_level(voltage_level: Optional[str]) -> Optional[str]:
    """Validate voltage ratings (e.g., '132/33 kV', '33/11 kV', '11 kV', '11/0.433 kV')."""
    if voltage_level is None:
        return None
    cleaned = voltage_level.strip()
    if not cleaned:
        return None
    if not VOLTAGE_PATTERN.match(cleaned):
        raise ValueError(
            f"Invalid voltage_level '{voltage_level}'. Expected format like '11 kV', '33/11 kV', '132/33 kV', or '11/0.433 kV'."
        )
    return cleaned


def validate_canonical_id(asset_id: str) -> str:
    cleaned = asset_id.strip()
    if not CANONICAL_ID_PATTERN.match(cleaned):
        raise ValueError(
            f"Invalid asset_id '{asset_id}'. Allowed characters: letters, digits, '-', '_', ':' (length 3-100)."
        )
    return cleaned


def build_and_validate_geometry(
    latitude: float,
    longitude: float,
    geometry_geojson: Optional[Dict[str, Any]] = None,
) -> BaseGeometry:
    """
    Build a Shapely geometry from either GeoJSON or lat/lon coordinates and
    verify topological validity + finite WGS84 coordinates.
    """
    lat, lon = validate_coordinates(latitude, longitude)

    if geometry_geojson is None:
        return Point(lon, lat)

    try:
        geom = shape(geometry_geojson)
    except Exception as exc:
        raise ValueError(f"Invalid GeoJSON geometry payload: {exc}") from exc

    if geom.is_empty:
        raise ValueError("Geometry cannot be empty.")
    if not geom.is_valid:
        raise ValueError("Geometry fails topological validity check (ST_IsValid).")

    if isinstance(geom, Point):
        validate_coordinates(geom.y, geom.x)
    elif isinstance(geom, LineString):
        coords = list(geom.coords)
        if len(coords) < 2:
            raise ValueError("LineString geometry must contain at least 2 vertices.")
        for c_lon, c_lat in coords:
            validate_coordinates(c_lat, c_lon)
    elif isinstance(geom, Polygon):
        for c_lon, c_lat in list(geom.exterior.coords):
            validate_coordinates(c_lat, c_lon)

    return geom


def validate_bbox_string(bbox: str) -> Tuple[float, float, float, float]:
    """Parse bbox='west,south,east,north' or 'south,west,north,east' safely."""
    parts = [p.strip() for p in bbox.split(",")]
    if len(parts) != 4:
        raise ValueError("Invalid bbox format. Expected 'south,west,north,east'.")
    try:
        south, west, north, east = [float(p) for p in parts]
    except ValueError as exc:
        raise ValueError("All bbox coordinates must be numeric.") from exc

    validate_coordinates(south, west)
    validate_coordinates(north, east)
    if south >= north or west >= east:
        raise ValueError("Invalid bbox bounds: south < north and west < east required.")
    return south, west, north, east


def coords_pairs_to_wkt_linestring(coords: List[Tuple[float, float]]) -> str:
    """Convert [(lon, lat), ...] into WKT LineString."""
    line = LineString(coords)
    if not line.is_valid or len(coords) < 2:
        raise ValueError("Invalid LineString coordinates.")
    return line.wkt
