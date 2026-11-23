from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_EVIDENCE_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
}
MAX_EVIDENCE_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB


class DecisionStatusEnum(str, Enum):
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    IMPLEMENTED = "IMPLEMENTED"
    CLOSED = "CLOSED"


class FieldTaskStatusEnum(str, Enum):
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    VERIFIED = "VERIFIED"


class PriorityLevelEnum(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class VerificationChecklistSchema(BaseModel):
    fault_resolved: bool = False
    equipment_tested: bool = False
    power_restored: bool = False
    safety_checks_completed: bool = False
    documentation_completed: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None

    def is_complete(self) -> bool:
        return (
            self.fault_resolved
            and self.equipment_tested
            and self.power_restored
            and self.safety_checks_completed
            and self.documentation_completed
        )


class DecisionCreateRequest(BaseModel):
    decision_id: Optional[str] = None
    decision_code: Optional[str] = None
    incident_id: Optional[str] = None
    fault_id: Optional[str] = None
    title: str = Field(..., min_length=3, max_length=255)
    rationale: str = Field(..., min_length=3)
    risk_assessment: str = Field(..., min_length=3)
    recommendation_summary: str = ""
    target_asset_id: str = Field(..., min_length=2, max_length=100)
    priority: PriorityLevelEnum = PriorityLevelEnum.HIGH
    risk_level: str = Field(default="MEDIUM", max_length=20)
    state: str = "Telangana"
    district: str = "Hyderabad"
    area: str = "HITEC City"
    evidence_bundle: Dict[str, Any] = Field(default_factory=dict)


class DecisionUpdateRequest(BaseModel):
    status: Optional[DecisionStatusEnum] = None
    escalated: Optional[bool] = None
    verification_checklist: Optional[VerificationChecklistSchema] = None
    resolution_summary: Optional[str] = None


class DecisionOut(BaseModel):
    decision_id: str
    decision_code: str
    incident_id: Optional[str] = None
    fault_id: Optional[str] = None
    title: str
    rationale: str
    risk_assessment: str
    recommendation_summary: str
    target_asset_id: str
    priority: str
    risk_level: str
    escalated: bool
    state: str
    district: str
    area: str
    proposed_by: str
    proposed_by_email: str
    reviewed_by: Optional[str] = None
    reviewed_by_email: Optional[str] = None
    status: str
    source: str
    evidence_bundle: Dict[str, Any]
    verification_checklist: Optional[Dict[str, Any]] = None
    resolution_summary: Optional[str] = None
    digital_signature_hash: Optional[str] = None
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApprovalCreateRequest(BaseModel):
    decision_id: str
    action: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    comments: str = Field(..., min_length=2)
    assigned_engineer: Optional[str] = None
    assigned_engineer_email: Optional[str] = None
    assigned_team: Optional[str] = None
    priority: PriorityLevelEnum = PriorityLevelEnum.HIGH


class ApprovalOut(BaseModel):
    approval_id: str
    decision_id: str
    action: str
    approver_name: str
    approver_email: str
    approver_role: str
    comments: str
    signature_hash: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FieldTaskCreateRequest(BaseModel):
    decision_id: str
    title: Optional[str] = None
    assigned_engineer: str
    assigned_engineer_email: str = "r.kulkarni@utilitygrid.org"
    assigned_team: str
    asset_id: str
    fault_location: str = "Substation Zone"
    gps_lat: float = Field(default=17.4435, ge=-90.0, le=90.0)
    gps_lon: float = Field(default=78.3772, ge=-180.0, le=180.0)
    safety_notes: str = ""
    priority: PriorityLevelEnum = PriorityLevelEnum.HIGH
    due_date: datetime


class FieldTaskUpdateRequest(BaseModel):
    status: Optional[FieldTaskStatusEnum] = None
    assigned_engineer: Optional[str] = None
    assigned_engineer_email: Optional[str] = None
    assigned_team: Optional[str] = None
    priority: Optional[PriorityLevelEnum] = None
    due_date: Optional[datetime] = None
    completion_notes: Optional[str] = None


class FieldTaskOut(BaseModel):
    task_id: str
    task_code: str
    decision_id: str
    incident_id: Optional[str] = None
    fault_id: Optional[str] = None
    title: str
    assigned_engineer: str
    assigned_engineer_email: str
    assigned_team: str
    asset_id: str
    fault_location: str
    gps_lat: float
    gps_lon: float
    safety_notes: str
    priority: str
    status: str
    scheduled_time: datetime
    due_date: datetime
    completion_notes: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceCreateRequest(BaseModel):
    task_id: str
    decision_id: str = ""
    file_name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., min_length=3, max_length=80)
    file_size_bytes: int = Field(..., gt=0)
    gps_lat: float = Field(..., ge=-90.0, le=90.0)
    gps_lon: float = Field(..., ge=-180.0, le=180.0)
    notes: str = ""
    inspection_result: str = Field(default="PASS", pattern="^(PASS|REPAIR_COMPLETED|FURTHER_WORK_REQUIRED)$")
    equipment_condition: str = Field(default="GOOD", pattern="^(GOOD|DEGRADED|REPLACED|FAULTED)$")
    meter_readings: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("mime_type")
    @classmethod
    def validate_mime(cls, value: str) -> str:
        norm = value.strip().lower()
        if norm not in ALLOWED_EVIDENCE_MIME_TYPES:
            raise ValueError("Unsupported evidence mime type. Allowed: PNG, JPG, WEBP, PDF.")
        return norm

    @field_validator("file_size_bytes")
    @classmethod
    def validate_size(cls, value: int) -> int:
        if value > MAX_EVIDENCE_SIZE_BYTES:
            raise ValueError("Evidence file exceeds 8 MB maximum limit.")
        return value


class EvidenceOut(BaseModel):
    evidence_id: str
    task_id: str
    decision_id: str
    file_name: str
    mime_type: str
    file_size_bytes: int
    gps_lat: float
    gps_lon: float
    notes: str
    inspection_result: str
    equipment_condition: str
    meter_readings: Dict[str, Any]
    uploaded_by: str
    uploaded_by_email: str
    source: str
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogOut(BaseModel):
    audit_id: str
    actor_email: str
    actor_role: str
    action_type: str
    module: str
    target_entity: str
    entity_id: str
    related_asset_id: Optional[str] = None
    related_incident_id: Optional[str] = None
    change_summary: str
    metadata_json: Dict[str, Any]
    ip_address: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationOut(BaseModel):
    notification_id: str
    notification_type: str
    title: str
    message: str
    severity: str
    read: bool
    related_asset_id: Optional[str] = None
    related_incident_id: Optional[str] = None
    related_decision_id: Optional[str] = None
    related_task_id: Optional[str] = None
    target_view: Optional[str] = None
    source: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
