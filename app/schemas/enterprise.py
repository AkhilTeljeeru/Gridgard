from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DigitalTwinNodeSchema(BaseModel):
    canonical_id: str
    name: str
    node_level: str
    parent_id: Optional[str] = None
    status: str
    health_score: int
    risk_level: str
    active_incidents_count: int = 0
    connected_asset_ids: List[str] = Field(default_factory=list)
    maintenance_status: str = "NOMINAL"
    state: str = "Telangana"
    district: str = "Hyderabad"


class DigitalTwinNetworkResponse(BaseModel):
    total_nodes: int
    total_edges: int
    faulted_nodes_count: int
    avg_health_score: float
    synchronized_at: str
    hierarchy_levels: List[str]
    nodes: List[DigitalTwinNodeSchema]


class ExecutiveDashboardResponse(BaseModel):
    total_grid_health_pct: float
    overall_network_risk: str
    active_faults_count: int
    ai_recommendations_count: int
    pending_approvals_count: int
    maintenance_backlog_count: int
    asset_reliability_pct: float
    region_scope: str
    insights: List[Dict[str, Any]]
    incident_trends: List[Dict[str, Any]]


class RegionalPerformanceResponse(BaseModel):
    count: int
    regions: List[Dict[str, Any]]


class EnterpriseReportCreateRequest(BaseModel):
    report_type: str
    export_format: str = "PDF"
    scope_label: str = "All Regions"
    row_count: int = 0


class ExecutiveReportsResponse(BaseModel):
    count: int
    reports: List[Dict[str, Any]]
