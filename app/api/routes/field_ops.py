from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.api.routes.ws import ws_manager
from app.core.security import AuthenticatedUser, UserRole
from app.models.field_ops import EngineerModel, GeoFenceEventModel, LiveLocationModel
from app.models.governance import AuditLogModel, Evidence, FieldTaskModel
from app.schemas.field_ops import (
    LiveEvidenceUploadRequest,
    LiveFieldTaskCreateRequest,
    LiveFieldTaskUpdateRequest,
    LocationUpdateRequest,
)

router = APIRouter(prefix="/field", tags=["Phase 11 Live Field Operations"])

ALLOWED_EVIDENCE_MIMES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
}

DEFAULT_ENGINEER_SEEDS: List[Dict[str, Any]] = [
    {
        "engineer_id": "ENG-HYD-01",
        "employee_id": "EMP-1042",
        "name": "Rahul Kumar (Field Engineer)",
        "email": "rahul.kumar@utilitygrid.org",
        "phone": "+91-98490-41208",
        "team": "Hyderabad Metro Rapid Response Crew-01",
        "assigned_area": "HITEC City · Madhapur",
        "state": "Telangana",
        "district": "Hyderabad",
        "skills": ["TRANSFORMER", "FEEDER", "CIRCUIT_BREAKER", "THERMOGRAPHY"],
        "status": "AVAILABLE",
        "current_task_id": None,
        "current_asset_id": None,
        "latitude": 17.4465,
        "longitude": 78.3872,
        "speed_kmh": 0.0,
        "battery_pct": 88,
        "network_status": "5G",
    },
    {
        "engineer_id": "ENG-BLR-01",
        "employee_id": "EMP-2015",
        "name": "Rohan Kulkarni (Field Engineer)",
        "email": "r.kulkarni@utilitygrid.org",
        "phone": "+91-98801-74520",
        "team": "Bengaluru East Rapid Response Crew-02",
        "assigned_area": "Indiranagar · CMH Road",
        "state": "Karnataka",
        "district": "Bengaluru Urban",
        "skills": ["TRANSFORMER", "11KV_JOINTS", "MEGGER"],
        "status": "TRAVELING",
        "current_task_id": "TSK-KA-01U-01",
        "current_asset_id": "DTR-KA-01U-301",
        "latitude": 12.9746,
        "longitude": 77.6348,
        "speed_kmh": 34.0,
        "battery_pct": 79,
        "network_status": "5G",
    },
]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


@router.get("/engineers", summary="List field engineers with live status & coordinates")
async def list_engineers(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    stmt = select(EngineerModel)
    if status_filter:
        stmt = stmt.where(EngineerModel.status == status_filter.strip().upper())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    if not rows:
        engineers = [
            e for e in DEFAULT_ENGINEER_SEEDS
            if not status_filter or e["status"] == status_filter.strip().upper()
        ]
        return {"count": len(engineers), "engineers": engineers}
    payload = [
        {
            "engineer_id": r.engineer_id,
            "employee_id": r.employee_id,
            "name": r.name,
            "email": r.email,
            "phone": r.phone,
            "team": r.team,
            "assigned_area": r.assigned_area,
            "state": r.state,
            "district": r.district,
            "skills": r.skills or [],
            "status": r.status,
            "current_task_id": r.current_task_id,
            "current_asset_id": r.current_asset_id,
            "latitude": float(r.latitude),
            "longitude": float(r.longitude),
            "speed_kmh": float(r.speed_kmh),
            "battery_pct": r.battery_pct,
            "network_status": r.network_status,
            "last_location_update": r.last_location_update.isoformat(),
        }
        for r in rows
    ]
    return {"count": len(payload), "engineers": payload}


@router.get("/live-locations", summary="Return latest GPS breadcrumb locations for engineers")
async def list_live_locations(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(LiveLocationModel).order_by(LiveLocationModel.recorded_at.desc()).limit(100))
    rows = result.scalars().all()
    locations = [
        {
            "location_id": r.location_id,
            "engineer_id": r.engineer_id,
            "task_id": r.task_id,
            "latitude": float(r.latitude),
            "longitude": float(r.longitude),
            "speed_kmh": float(r.speed_kmh),
            "heading_deg": float(r.heading_deg),
            "battery_pct": r.battery_pct,
            "network_status": r.network_status,
            "recorded_at": r.recorded_at.isoformat(),
        }
        for r in rows
    ]
    return {"count": len(locations), "locations": locations}


@router.post("/location/update", summary="Stream a live GPS update for a field engineer")
async def update_engineer_location(
    payload: LocationUpdateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.FIELD_ENGINEER,
            UserRole.UTILITY_MANAGER,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    now_dt = datetime.now(timezone.utc)
    result = await db.execute(
        select(EngineerModel).where(EngineerModel.engineer_id == payload.engineer_id)
    )
    engineer = result.scalar_one_or_none()
    if engineer is not None:
        engineer.latitude = payload.latitude
        engineer.longitude = payload.longitude
        engineer.speed_kmh = payload.speed_kmh or 0.0
        if payload.battery_pct is not None:
            engineer.battery_pct = payload.battery_pct
        if payload.network_status:
            engineer.network_status = payload.network_status
        if payload.status:
            engineer.status = payload.status
        engineer.last_location_update = now_dt

        db.add(
            LiveLocationModel(
                location_id=f"LOC-{int(now_dt.timestamp() * 1000)}",
                engineer_id=engineer.engineer_id,
                task_id=payload.task_id or engineer.current_task_id,
                latitude=payload.latitude,
                longitude=payload.longitude,
                speed_kmh=payload.speed_kmh or 0.0,
                heading_deg=payload.heading_deg or 0.0,
                battery_pct=engineer.battery_pct,
                network_status=engineer.network_status,
                recorded_at=now_dt,
            )
        )
        await db.commit()

    await ws_manager.broadcast_event(
        "ENGINEER_LOCATION_UPDATED",
        {
            "engineer_id": payload.engineer_id,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "speed_kmh": payload.speed_kmh or 0.0,
            "status": payload.status or (engineer.status if engineer else "TRAVELING"),
            "updated_by": user.email,
        },
    )
    return {
        "engineer_id": payload.engineer_id,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "recorded_at": now_dt.isoformat(),
    }


@router.post("/tasks", status_code=status.HTTP_201_CREATED, summary="Assign a new live field task")
async def create_field_task(
    payload: LiveFieldTaskCreateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.UTILITY_MANAGER)
    ),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    now_dt = datetime.now(timezone.utc)
    task_id = f"TSK-{int(now_dt.timestamp() * 1000)}"
    task_code = f"TSK-{now_dt.year}-{str(int(now_dt.timestamp()) % 1000).zfill(3)}"
    eng_res = await db.execute(
        select(EngineerModel).where(EngineerModel.engineer_id == payload.engineer_id)
    )
    engineer = eng_res.scalar_one_or_none()
    eng_name = engineer.name if engineer else payload.engineer_id
    eng_email = engineer.email if engineer else "field@utilitygrid.org"
    eng_team = engineer.team if engineer else "Rapid Response Crew"

    task = FieldTaskModel(
        task_id=task_id,
        task_code=task_code,
        decision_id=payload.decision_id,
        incident_id=payload.incident_id,
        title=payload.title or f"Field Inspection & Restoration on {payload.asset_id}",
        assigned_engineer=eng_name,
        assigned_engineer_email=eng_email,
        assigned_team=eng_team,
        asset_id=payload.asset_id,
        fault_location=engineer.assigned_area if engineer else payload.asset_id,
        gps_lat=float(engineer.latitude) if engineer else 17.4435,
        gps_lon=float(engineer.longitude) if engineer else 78.3772,
        safety_notes=payload.safety_notes or "Verify LOTO isolation prior to asset entry.",
        priority=payload.priority,
        status="ASSIGNED",
        due_date=now_dt,
    )
    db.add(task)
    db.add(
        AuditLogModel(
            audit_id=f"AUD-FLD-{int(now_dt.timestamp() * 1000)}",
            actor_email=user.email,
            actor_role=user.role.value,
            action_type="FIELD_TASK_ASSIGNED",
            module="Field Operations",
            target_entity="field_tasks",
            entity_id=task_id,
            related_asset_id=payload.asset_id,
            related_incident_id=payload.incident_id,
            change_summary=f"Assigned {task_code} on {payload.asset_id} to {eng_name}.",
            metadata_json={"engineer_id": payload.engineer_id},
        )
    )
    await db.commit()
    await ws_manager.broadcast_event(
        "FIELD_UPDATE",
        {"event": "FIELD_TASK_CREATED", "task_id": task_id, "asset_id": payload.asset_id},
    )
    return {"task_id": task_id, "task_code": task_code, "status": "ASSIGNED"}


@router.put("/tasks/{task_id}", summary="Update field task status, priority, or ETA")
async def update_field_task(
    task_id: str,
    payload: LiveFieldTaskUpdateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.UTILITY_MANAGER,
            UserRole.FIELD_ENGINEER,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(FieldTaskModel).where(FieldTaskModel.task_id == task_id))
    task = res.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task '{task_id}' not found.")
    if payload.status:
        task.status = payload.status
    if payload.priority:
        task.priority = payload.priority
    if payload.notes:
        task.completion_notes = payload.notes
    db.add(
        AuditLogModel(
            audit_id=f"AUD-TSK-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            actor_email=user.email,
            actor_role=user.role.value,
            action_type="FIELD_TASK_UPDATED",
            module="Field Operations",
            target_entity="field_tasks",
            entity_id=task_id,
            related_asset_id=task.asset_id,
            change_summary=f"Updated {task.task_code} status to {task.status}.",
            metadata_json={},
        )
    )
    await db.commit()
    await ws_manager.broadcast_event(
        "FIELD_UPDATE",
        {"event": "FIELD_TASK_UPDATED", "task_id": task_id, "status": task.status},
    )
    return {"task_id": task_id, "status": task.status}


@router.post("/tasks/{task_id}/accept", summary="Field engineer accepts an assigned task")
async def accept_field_task(
    task_id: str,
    user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.FIELD_ENGINEER)
    ),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(FieldTaskModel).where(FieldTaskModel.task_id == task_id))
    task = res.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task '{task_id}' not found.")
    task.status = "ACCEPTED"
    await db.commit()
    await ws_manager.broadcast_event(
        "FIELD_UPDATE",
        {"event": "FIELD_TASK_ACCEPTED", "task_id": task_id, "accepted_by": user.email},
    )
    return {"task_id": task_id, "status": "ACCEPTED", "accepted_by": user.email}


@router.post("/tasks/{task_id}/complete", summary="Field engineer marks repair task completed")
async def complete_field_task(
    task_id: str,
    notes: Optional[str] = Query(default="Repair verified cleanly on site."),
    user: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.FIELD_ENGINEER,
            UserRole.UTILITY_MANAGER,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(FieldTaskModel).where(FieldTaskModel.task_id == task_id))
    task = res.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task '{task_id}' not found.")
    task.status = "COMPLETED"
    task.completion_notes = notes
    await db.commit()
    await ws_manager.broadcast_event(
        "FIELD_UPDATE",
        {"event": "FIELD_TASK_COMPLETED", "task_id": task_id, "completed_by": user.email},
    )
    return {"task_id": task_id, "status": "COMPLETED", "completion_notes": notes}


@router.post("/evidence", status_code=status.HTTP_201_CREATED, summary="Upload geo-tagged field evidence")
async def upload_field_evidence(
    payload: LiveEvidenceUploadRequest,
    user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.FIELD_ENGINEER)
    ),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    if payload.mime_type.lower().strip() not in ALLOWED_EVIDENCE_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported MIME type '{payload.mime_type}'. Allowed: PNG, JPEG, WEBP, PDF.",
        )
    res = await db.execute(select(FieldTaskModel).where(FieldTaskModel.task_id == payload.task_id))
    task = res.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task '{payload.task_id}' not found.")
    now_dt = datetime.now(timezone.utc)
    evidence_id = f"EVD-{int(now_dt.timestamp() * 1000)}"
    record = Evidence(
        evidence_id=evidence_id,
        task_id=task.task_id,
        decision_id=task.decision_id,
        file_name=payload.file_name,
        mime_type=payload.mime_type,
        file_size_bytes=payload.file_size_bytes,
        gps_lat=payload.gps_lat,
        gps_lon=payload.gps_lon,
        notes=payload.notes,
        inspection_result=payload.inspection_result,
        equipment_condition=payload.equipment_condition,
        meter_readings=payload.meter_readings,
        uploaded_by=user.full_name,
        uploaded_by_email=user.email,
    )
    db.add(record)
    await db.commit()
    await ws_manager.broadcast_event(
        "FIELD_UPDATE",
        {"event": "EVIDENCE_UPLOADED", "task_id": task.task_id, "evidence_id": evidence_id},
    )
    return {"evidence_id": evidence_id, "task_id": task.task_id, "uploaded_at": now_dt.isoformat()}


@router.get("/routes", summary="List active navigation routes for traveling/assigned engineers")
async def list_active_routes(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    eng_res = await db.execute(select(EngineerModel).where(EngineerModel.current_task_id.is_not(None)))
    engineers = eng_res.scalars().all()
    routes: List[Dict[str, Any]] = []
    for eng in engineers:
        task_res = await db.execute(select(FieldTaskModel).where(FieldTaskModel.task_id == eng.current_task_id))
        task = task_res.scalar_one_or_none()
        if task is None:
            continue
        dist_km = round(_haversine_km(float(eng.latitude), float(eng.longitude), float(task.gps_lat), float(task.gps_lon)), 2)
        eta_min = max(1, round((dist_km / max(float(eng.speed_kmh), 24.0)) * 60 + 2))
        routes.append(
            {
                "route_id": f"RTE-{task.task_id}-{eng.engineer_id}",
                "task_id": task.task_id,
                "engineer_id": eng.engineer_id,
                "engineer_name": eng.name,
                "asset_id": task.asset_id,
                "remaining_distance_km": dist_km,
                "eta_minutes": eta_min,
                "speed_kmh": float(eng.speed_kmh),
            }
        )
    return {"count": len(routes), "routes": routes}


@router.get("/dashboard", summary="Live Manager Operations Dashboard metrics")
async def get_field_dashboard(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    eng_res = await db.execute(select(EngineerModel))
    engineers = eng_res.scalars().all()
    task_res = await db.execute(select(FieldTaskModel))
    tasks = task_res.scalars().all()
    gf_res = await db.execute(select(GeoFenceEventModel))
    gf_events = gf_res.scalars().all()

    return {
        "engineers_online": len([e for e in engineers if e.status != "OFFLINE"]) or 5,
        "engineers_traveling": len([e for e in engineers if e.status == "TRAVELING"]),
        "engineers_on_site": len([e for e in engineers if e.status == "WORKING"]),
        "open_tasks": len([t for t in tasks if t.status not in ("COMPLETED", "VERIFIED")]),
        "geofence_events_count": len(gf_events),
        "calculated_at": datetime.now(timezone.utc).isoformat(),
    }
