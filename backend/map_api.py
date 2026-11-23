"""
GridGuard AI - FastAPI + PostGIS Spatial Map Router (Phase 2)
Provides PostgreSQL / PostGIS backed endpoints mirroring /api/map/* routes.
"""

from typing import Any, Dict, List, Optional
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/map", tags=["Grid Map"])


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    id: str
    geometry: Dict[str, Any]
    properties: Dict[str, Any]


async def get_db():
    """
    Yield an asyncpg connection or SQLAlchemy session configured via DATABASE_URL.
    Override via FastAPI app.dependency_overrides[get_db].
    """
    raise HTTPException(
        status_code=501,
        detail="Configure PostgreSQL/PostGIS dependency override for get_db.",
    )


def _build_asset_filters(
    state: Optional[str],
    district: Optional[str],
    city: Optional[str],
    area: Optional[str],
    pincode: Optional[str],
    substation_id: Optional[str],
    feeder_id: Optional[str],
    transformer_id: Optional[str],
    bbox: Optional[str],
) -> tuple[str, List[Any]]:
    clauses: List[str] = ["1=1"]
    params: List[Any] = []
    idx = 1

    def add_eq(column: str, value: Optional[str]) -> None:
        nonlocal idx
        if value:
            clauses.append(f"LOWER({column}) = LOWER(${idx})")
            params.append(value.strip())
            idx += 1

    add_eq("state", state)
    add_eq("district", district)
    add_eq("city", city)
    add_eq("area", area)
    add_eq("pincode", pincode)
    add_eq("substation_id", substation_id)
    add_eq("feeder_id", feeder_id)
    if transformer_id:
        clauses.append(f"LOWER(canonical_id) = LOWER(${idx})")
        params.append(transformer_id.strip())
        idx += 1

    if bbox:
        try:
            south, west, north, east = [float(x.strip()) for x in bbox.split(",")]
            clauses.append(
                f"ST_Intersects(geom, ST_MakeEnvelope(${idx}, ${idx + 1}, ${idx + 2}, ${idx + 3}, 4326))"
            )
            params.extend([west, south, east, north])
            idx += 4
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid bbox=south,west,north,east") from exc

    return " AND ".join(clauses), params


@router.get("/assets")
async def get_map_assets(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    area: Optional[str] = Query(None),
    pincode: Optional[str] = Query(None),
    substationId: Optional[str] = Query(None),
    feederId: Optional[str] = Query(None),
    transformerId: Optional[str] = Query(None),
    bbox: Optional[str] = Query(None),
    db=Depends(get_db),
):
    where_sql, params = _build_asset_filters(
        state, district, city, area, pincode, substationId, feederId, transformerId, bbox
    )
    sql = f"""
        SELECT
            canonical_id,
            name,
            asset_type::text AS asset_type,
            source::text AS source,
            substation_id,
            feeder_id,
            voltage_rating,
            operator,
            status,
            state,
            district,
            city,
            area,
            pincode,
            installation_date::text AS installation_date,
            last_inspection_date::text AS last_inspection_date,
            latitude::float AS latitude,
            longitude::float AS longitude,
            ST_AsGeoJSON(geom) AS geom_json
        FROM infrastructure_assets
        WHERE {where_sql}
        ORDER BY canonical_id ASC
        LIMIT 2000
    """
    rows = await db.fetch(sql, *params)
    features: List[Dict[str, Any]] = []
    for row in rows:
        features.append(
            {
                "type": "Feature",
                "id": row["canonical_id"],
                "geometry": json.loads(row["geom_json"]),
                "properties": {
                    "canonicalId": row["canonical_id"],
                    "name": row["name"],
                    "assetType": row["asset_type"],
                    "source": row["source"],
                    "substationId": row["substation_id"],
                    "feederId": row["feeder_id"],
                    "voltage": row["voltage_rating"] or "Not available",
                    "operator": row["operator"] or "Not available",
                    "status": row["status"],
                    "state": row["state"],
                    "district": row["district"],
                    "area": row["area"],
                    "installationDate": row["installation_date"] or "Not available",
                    "lastInspectionDate": row["last_inspection_date"] or "Not available",
                },
            }
        )
    return {
        "count": len(features),
        "geojson": {"type": "FeatureCollection", "features": features},
    }


@router.get("/search")
async def search_map_assets(q: str = Query(..., min_length=1), db=Depends(get_db)):
    pattern = f"%{q.strip()}%"
    rows = await db.fetch(
        """
        SELECT canonical_id, name, asset_type::text AS asset_type, source::text AS source,
               state, district, area, pincode, latitude::float AS latitude, longitude::float AS longitude
        FROM infrastructure_assets
        WHERE canonical_id ILIKE $1
           OR name ILIKE $1
           OR state ILIKE $1
           OR district ILIKE $1
           OR area ILIKE $1
           OR pincode ILIKE $1
           OR COALESCE(landmarks, '') ILIKE $1
        ORDER BY canonical_id ASC
        LIMIT 25
        """,
        pattern,
    )
    return {"query": q, "count": len(rows), "results": [dict(r) for r in rows]}


@router.get("/states")
async def list_states(db=Depends(get_db)):
    rows = await db.fetch(
        "SELECT DISTINCT state FROM infrastructure_assets ORDER BY state ASC"
    )
    return {"states": [r["state"] for r in rows]}


@router.get("/districts")
async def list_districts(state: Optional[str] = Query(None), db=Depends(get_db)):
    if state:
        rows = await db.fetch(
            "SELECT DISTINCT district FROM infrastructure_assets WHERE LOWER(state) = LOWER($1) ORDER BY district ASC",
            state.strip(),
        )
    else:
        rows = await db.fetch(
            "SELECT DISTINCT district FROM infrastructure_assets ORDER BY district ASC"
        )
    return {"districts": [r["district"] for r in rows]}


@router.get("/areas")
async def list_areas(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db=Depends(get_db),
):
    clauses = ["1=1"]
    params: List[Any] = []
    if state:
        params.append(state.strip())
        clauses.append(f"LOWER(state) = LOWER(${len(params)})")
    if district:
        params.append(district.strip())
        clauses.append(f"LOWER(district) = LOWER(${len(params)})")
    rows = await db.fetch(
        f"SELECT DISTINCT area FROM infrastructure_assets WHERE {' AND '.join(clauses)} ORDER BY area ASC",
        *params,
    )
    return {"areas": [r["area"] for r in rows]}


@router.get("/substations")
async def list_substations(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db=Depends(get_db),
):
    clauses = ["asset_type = 'SUBSTATION'"]
    params: List[Any] = []
    if state:
        params.append(state.strip())
        clauses.append(f"LOWER(state) = LOWER(${len(params)})")
    if district:
        params.append(district.strip())
        clauses.append(f"LOWER(district) = LOWER(${len(params)})")
    rows = await db.fetch(
        f"SELECT canonical_id AS id, name AS label FROM infrastructure_assets WHERE {' AND '.join(clauses)} ORDER BY canonical_id",
        *params,
    )
    return {"substations": [dict(r) for r in rows]}


@router.get("/feeders")
async def list_feeders(substationId: Optional[str] = Query(None), db=Depends(get_db)):
    if substationId:
        rows = await db.fetch(
            "SELECT canonical_id AS id, name AS label FROM infrastructure_assets WHERE asset_type = 'FEEDER' AND substation_id = $1 ORDER BY canonical_id",
            substationId.strip(),
        )
    else:
        rows = await db.fetch(
            "SELECT canonical_id AS id, name AS label FROM infrastructure_assets WHERE asset_type = 'FEEDER' ORDER BY canonical_id"
        )
    return {"feeders": [dict(r) for r in rows]}


@router.get("/transformers")
async def list_transformers(
    substationId: Optional[str] = Query(None),
    feederId: Optional[str] = Query(None),
    db=Depends(get_db),
):
    clauses = ["asset_type = 'TRANSFORMER'"]
    params: List[Any] = []
    if substationId:
        params.append(substationId.strip())
        clauses.append(f"substation_id = ${len(params)}")
    if feederId:
        params.append(feederId.strip())
        clauses.append(f"feeder_id = ${len(params)}")
    rows = await db.fetch(
        f"SELECT canonical_id AS id, name AS label FROM infrastructure_assets WHERE {' AND '.join(clauses)} ORDER BY canonical_id",
        *params,
    )
    return {"transformers": [dict(r) for r in rows]}


@router.get("/faults")
async def list_faults(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    area: Optional[str] = Query(None),
    feederId: Optional[str] = Query(None),
    db=Depends(get_db),
):
    clauses = ["status = 'FAULTED'"]
    params: List[Any] = []
    for col, val in [("state", state), ("district", district), ("area", area), ("feeder_id", feederId)]:
        if val:
            params.append(val.strip())
            clauses.append(f"LOWER({col}) = LOWER(${len(params)})")
    rows = await db.fetch(
        f"""
        SELECT canonical_id, name, substation_id, feeder_id, source::text AS source,
               latitude::float AS latitude, longitude::float AS longitude,
               ST_AsGeoJSON(geom) AS geom_json
        FROM infrastructure_assets
        WHERE {' AND '.join(clauses)}
        """,
        *params,
    )
    return {"count": len(rows), "faults": [dict(r) for r in rows]}
