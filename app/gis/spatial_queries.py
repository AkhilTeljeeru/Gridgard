from geoalchemy2 import Geography
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_Intersects, ST_MakeEnvelope, ST_SetSRID, ST_MakePoint, ST_Within
from sqlalchemy import cast, func, select
from sqlalchemy.sql.elements import ColumnElement

from app.models.geography import Area, District
from app.models.grid import UtilityAsset


def within_area_filter(asset_geom: ColumnElement, area_id: int) -> ColumnElement:
    """PostGIS predicate matching assets inside a selected Area polygon."""
    area_geom_subq = (
        select(Area.geometry).where(Area.id == area_id).scalar_subquery()
    )
    return ST_Within(asset_geom, area_geom_subq)


def intersecting_district_filter(asset_geom: ColumnElement, district_id: int) -> ColumnElement:
    """PostGIS predicate matching assets intersecting a District polygon."""
    district_geom_subq = (
        select(District.geometry).where(District.id == district_id).scalar_subquery()
    )
    return ST_Intersects(asset_geom, district_geom_subq)


def bbox_intersects_filter(
    geom_column: ColumnElement,
    south: float,
    west: float,
    north: float,
    east: float,
) -> ColumnElement:
    """Fast GIST-indexed bounding box filter via PostGIS ST_MakeEnvelope."""
    envelope = ST_MakeEnvelope(west, south, east, north, 4326)
    return ST_Intersects(geom_column, envelope)


def within_radius_geography_filter(
    geom_column: ColumnElement,
    latitude: float,
    longitude: float,
    radius_meters: float,
) -> ColumnElement:
    """Accurate spheroidal radius filter (meters) via Geography cast + ST_DWithin."""
    origin_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    return ST_DWithin(
        cast(geom_column, Geography(srid=4326)),
        cast(origin_point, Geography(srid=4326)),
        radius_meters,
    )


def distance_meters_expression(
    geom_column: ColumnElement,
    latitude: float,
    longitude: float,
) -> ColumnElement:
    """Spheroidal distance in meters computed directly inside PostGIS."""
    origin_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    return ST_Distance(
        cast(geom_column, Geography(srid=4326)),
        cast(origin_point, Geography(srid=4326)),
    )


def knn_distance_operator(
    geom_column: ColumnElement,
    latitude: float,
    longitude: float,
) -> ColumnElement:
    """PostGIS <-> nearest-neighbor index operator for ultra-fast KNN ordering."""
    origin_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    return geom_column.op("<->")(origin_point)


def area_geojson_select(geom_column: ColumnElement) -> ColumnElement:
    return func.ST_AsGeoJSON(geom_column)
