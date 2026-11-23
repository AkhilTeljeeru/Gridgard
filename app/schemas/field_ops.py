from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


EngineerStatusLiteral = Literal["AVAILABLE", "TRAVELING", "WORKING", "ON_BREAK", "OFFLINE"]
TaskStatusLiteral = Literal[
    "ASSIGNED",
    "ACCEPTED",
    "TRAVELING",
    "ON_SITE",
    "INSPECTION",
    "REPAIR",
    "VERIFICATION",
    "IN_PROGRESS",
    "PAUSED",
    "COMPLETED",
    "VERIFIED",
]


class LocationUpdateRequest(BaseModel):
    engineer_id: str = Field(..., min_length=2, max_length=100)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    speed_kmh: Optional[float] = Field(default=0.0, ge=0.0, le=180.0)
    heading_deg: Optional[float] = Field(default=0.0, ge=0.0, le=360.0)
    battery_pct: Optional[int] = Field(default=None, ge=0, le=100)
    network_status: Optional[str] = Field(default=None, max_length=20)
    status: Optional[EngineerStatusLiteral] = None
    task_id: Optional[str] = Field(default=None, max_length=100)


class EngineerOut(BaseModel):
    engineer_id: str
    employee_id: str
    name: str
    email: str
    phone: str
    team: str
    assigned_area: str
    state: str
    district: str
    skills: List[str] = Field(default_factory=list)
    status: EngineerStatusLiteral
    current_task_id: Optional[str] = None
    current_asset_id: Optional[str] = None
    latitude: float
    longitude: float
    speed_kmh: float
    battery_pct: int
    network_status: str
    last_location_update: str


class LiveFieldTaskCreateRequest(BaseModel):
    decision_id: str = Field(..., min_length=2, max_length=100)
    incident_id: Optional[str] = Field(default=None, max_length=100)
    asset_id: str = Field(..., min_length=2, max_length=100)
    engineer_id: str = Field(..., min_length=2, max_length=100)
    title: Optional[str] = Field(default=None, max_length=255)
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "HIGH"
    due_date: Optional[str] = None
    safety_notes: Optional[str] = Field(default="", max_length=2000)


class LiveFieldTaskUpdateRequest(BaseModel):
    status: Optional[TaskStatusLiteral] = None
    engineer_id: Optional[str] = None
    priority: Optional[Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]] = None
    eta_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    notes: Optional[str] = Field(default=None, max_length=2000)


class LiveEvidenceUploadRequest(BaseModel):
    task_id: str = Field(..., min_length=2, max_length=100)
    file_name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., min_length=3, max_length=80)
    file_size_bytes: int = Field(..., gt=0, le=8 * 1024 * 1024)
    gps_lat: float = Field(..., ge=-90.0, le=90.0)
    gps_lon: float = Field(..., ge=-180.0, le=180.0)
    notes: str = Field(default="", max_length=2000)
    repair_notes: Optional[str] = Field(default=None, max_length=2000)
    inspection_result: Literal["PASS", "REPAIR_COMPLETED", "FURTHER_WORK_REQUIRED"] = "PASS"
    equipment_condition: Literal["GOOD", "DEGRADED", "REPLACED", "FAULTED"] = "GOOD"
    meter_readings: Dict[str, Any] = Field(default_factory=dict)
