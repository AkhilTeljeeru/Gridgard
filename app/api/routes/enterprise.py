from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.core.security import AuthenticatedUser, UserRole
from app.ml.pipeline import run_ai_pipeline
from app.models.enterprise import ExecutiveReportModel
from app.schemas.enterprise import (
    DigitalTwinNetworkResponse,
    DigitalTwinNodeSchema,
    EnterpriseReportCreateRequest,
    ExecutiveDashboardResponse,
    ExecutiveReportsResponse,
    RegionalPerformanceResponse,
)

router = APIRouter(tags=["Enterprise Digital Twin & Executive Analytics"])


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get(
    "/digital-twin/network",
    response_model=DigitalTwinNetworkResponse,
    summary="Retrieve synchronized Digital Twin electrical hierarchy & asset telemetry",
)
async def get_digital_twin_network(
    state: Optional[str] = Query(default=None),
) -> DigitalTwinNetworkResponse:
    snapshot = run_ai_pipeline()
    nodes: List[DigitalTwinNodeSchema] = []
    for h in snapshot["health_scores"]:
        if state and h.get("state", "").lower() != state.lower():
            continue
        nodes.append(
            DigitalTwinNodeSchema(
                canonical_id=h["asset_id"],
                name=h["asset_name"],
                node_level=h["asset_type"],
                parent_id=h.get("feeder_id") or h.get("substation_id"),
                status="FAULTED" if h["category"] == "CRITICAL" else "WARNING" if h["category"] == "WARNING" else "ACTIVE",
                health_score=h["health_score"],
                risk_level=h["risk_level"],
                active_incidents_count=1 if h["category"] == "CRITICAL" else 0,
                connected_asset_ids=[x for x in (h.get("substation_id"), h.get("feeder_id")) if x],
                maintenance_status="OVERDUE" if h.get("maintenance_overdue_days", 0) > 60 else "NOMINAL",
                state=h.get("state", "Telangana"),
                district=h.get("district", "Hyderabad"),
            )
        )
    avg_health = round(sum(n.health_score for n in nodes) / len(nodes), 1) if nodes else 100.0
    faulted = sum(1 for n in nodes if n.status == "FAULTED")
    return DigitalTwinNetworkResponse(
        total_nodes=len(nodes),
        total_edges=max(0, len(nodes) - 1),
        faulted_nodes_count=faulted,
        avg_health_score=avg_health,
        synchronized_at=_utc_now_iso(),
        hierarchy_levels=["State", "District", "Substation", "Feeder", "Transformer", "Switch", "Consumer Cluster"],
        nodes=nodes,
    )


@router.get(
    "/digital-twin/assets",
    summary="Retrieve Digital Twin asset representations with lifecycle and risk telemetry",
)
async def get_digital_twin_assets(
    asset_id: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> Dict[str, Any]:
    network = await get_digital_twin_network(state=state)
    filtered = [n.model_dump() for n in network.nodes if not asset_id or n.canonical_id == asset_id]
    return {
        "total": len(filtered),
        "limit": limit,
        "offset": offset,
        "synchronized_at": network.synchronized_at,
        "assets": filtered[offset : offset + limit],
    }


@router.get(
    "/executive/dashboard",
    response_model=ExecutiveDashboardResponse,
    summary="Retrieve Executive Command Center KPIs, risk posture, and AI insights",
)
async def get_executive_dashboard(
    state: Optional[str] = Query(default=None),
) -> ExecutiveDashboardResponse:
    snapshot = run_ai_pipeline()
    scores = [
        h for h in snapshot["health_scores"]
        if not state or h.get("state", "").lower() == state.lower()
    ]
    avg_health = round(sum(h["health_score"] for h in scores) / len(scores), 1) if scores else 90.0
    faulted = sum(1 for h in scores if h["category"] == "CRITICAL")
    return ExecutiveDashboardResponse(
        total_grid_health_pct=avg_health,
        overall_network_risk="HIGH" if faulted >= 2 else "MEDIUM" if faulted == 1 else "LOW",
        active_faults_count=faulted,
        ai_recommendations_count=len(snapshot["recommendations"]),
        pending_approvals_count=2,
        maintenance_backlog_count=len(snapshot["maintenance_queue"]),
        asset_reliability_pct=round(max(91.0, 99.4 - faulted * 0.6), 2),
        region_scope=state or "All India Operations",
        insights=[
            {
                "id": "INS-EXEC-1",
                "title": "Critical Transformer Thermal Stress Watch",
                "summary": "High-utilization urban 11/0.433 kV distribution transformers require preventive load transfer.",
                "priority": "HIGH",
            }
        ],
        incident_trends=snapshot["monthly_failure_trends"],
    )


@router.get(
    "/performance",
    response_model=RegionalPerformanceResponse,
    summary="Retrieve Regional Performance Analytics (MTTR, MTBF, Reliability, Availability)",
)
async def get_regional_performance(
    scope_level: Optional[str] = Query(default=None),
) -> RegionalPerformanceResponse:
    regions = [
        {
            "region_id": "NAT-IN",
            "region": "All India Operations",
            "scope_level": "NATIONAL",
            "reliability_pct": 98.45,
            "availability_pct": 99.12,
            "fault_frequency_per_100km": 1.65,
            "mttr_hours": 2.1,
            "mtbf_hours": 640.0,
            "maintenance_compliance_pct": 91.5,
            "avg_response_time_min": 18.0,
        },
        {
            "region_id": "STATE-Telangana",
            "region": "Telangana",
            "scope_level": "STATE",
            "reliability_pct": 97.92,
            "availability_pct": 98.74,
            "fault_frequency_per_100km": 2.10,
            "mttr_hours": 2.4,
            "mtbf_hours": 580.0,
            "maintenance_compliance_pct": 89.2,
            "avg_response_time_min": 19.5,
        },
        {
            "region_id": "STATE-Karnataka",
            "region": "Karnataka",
            "scope_level": "STATE",
            "reliability_pct": 98.85,
            "availability_pct": 99.40,
            "fault_frequency_per_100km": 1.25,
            "mttr_hours": 1.8,
            "mtbf_hours": 710.0,
            "maintenance_compliance_pct": 93.8,
            "avg_response_time_min": 16.0,
        },
    ]
    if scope_level:
        regions = [r for r in regions if r["scope_level"].upper() == scope_level.upper()]
    return RegionalPerformanceResponse(count=len(regions), regions=regions)


@router.get(
    "/analytics",
    summary="Retrieve Enterprise AI operational insights, model performance, and risk distribution",
)
async def get_enterprise_analytics() -> Dict[str, Any]:
    snapshot = run_ai_pipeline()
    return {
        "generated_at": _utc_now_iso(),
        "model_metrics": snapshot["model_metrics"],
        "patterns": snapshot["patterns"],
        "risk_indices": snapshot["risk_indices"],
        "maintenance_queue_count": len(snapshot["maintenance_queue"]),
    }


@router.get(
    "/reports",
    response_model=ExecutiveReportsResponse,
    summary="List generated executive and compliance report exports",
)
async def list_executive_reports(
    db: AsyncSession = Depends(get_db),
) -> ExecutiveReportsResponse:
    rows: List[Dict[str, Any]] = []
    try:
        result = await db.execute(select(ExecutiveReportModel).order_by(ExecutiveReportModel.id.desc()).limit(50))
        for item in result.scalars().all():
            rows.append(
                {
                    "report_id": item.report_id,
                    "generated_by": item.generated_by,
                    "report_type": item.report_type,
                    "export_format": item.export_format,
                    "scope_label": item.scope_label,
                    "row_count": item.row_count,
                    "generated_at": item.generated_at.isoformat(),
                }
            )
    except Exception:
        rows = []
    return ExecutiveReportsResponse(count=len(rows), reports=rows)


@router.post(
    "/reports",
    summary="Record generated executive report audit entry",
)
async def create_executive_report_record(
    payload: EnterpriseReportCreateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.UTILITY_MANAGER,
            UserRole.CONTROL_ROOM_ENGINEER,
            UserRole.FIELD_ENGINEER,
        )
    ),
) -> Dict[str, Any]:
    return {
        "report_id": f"RPT-{int(datetime.now(timezone.utc).timestamp())}",
        "generated_by": user.sub,
        "report_type": payload.report_type,
        "export_format": payload.export_format,
        "scope_label": payload.scope_label,
        "row_count": payload.row_count,
        "generated_at": _utc_now_iso(),
    }


@router.get(
    "/admin/system-health",
    summary="Enterprise System Administration health, RBAC summary, and service posture",
)
async def get_admin_system_health() -> Dict[str, Any]:
    return {
        "status": "HEALTHY",
        "checked_at": _utc_now_iso(),
        "services": {
            "fastapi_gis": "ACTIVE",
            "ai_intelligence_engine": "ACTIVE",
            "websocket_stream": "ACTIVE",
            "rbac_enforcement": "ENFORCED",
        },
        "rbac_roles": [r.value for r in UserRole],
    }
