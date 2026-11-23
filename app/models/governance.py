from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Decision(Base):
    __tablename__ = "decisions"
    __table_args__ = (
        Index("idx_gov_decisions_status", "status"),
        Index("idx_gov_decisions_asset", "target_asset_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    decision_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    decision_code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    incident_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fault_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    risk_assessment: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    target_asset_id: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="HIGH")
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM")
    escalated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="Telangana")
    district: Mapped[str] = mapped_column(String(100), nullable=False, default="Hyderabad")
    area: Mapped[str] = mapped_column(String(100), nullable=False, default="HITEC City")
    proposed_by: Mapped[str] = mapped_column(String(150), nullable=False)
    proposed_by_email: Mapped[str] = mapped_column(String(255), nullable=False)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    reviewed_by_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING_REVIEW")
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    evidence_bundle: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    verification_checklist: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    resolution_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    digital_signature_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    closed_by: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    approvals: Mapped[List["Approval"]] = relationship(
        back_populates="decision", cascade="all, delete-orphan"
    )
    tasks: Mapped[List["FieldTaskModel"]] = relationship(
        back_populates="decision", cascade="all, delete-orphan"
    )


class Approval(Base):
    __tablename__ = "approvals"
    __table_args__ = (Index("idx_approvals_decision", "decision_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    approval_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    decision_id: Mapped[str] = mapped_column(
        ForeignKey("decisions.decision_id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    approver_name: Mapped[str] = mapped_column(String(150), nullable=False)
    approver_email: Mapped[str] = mapped_column(String(255), nullable=False)
    approver_role: Mapped[str] = mapped_column(String(50), nullable=False)
    comments: Mapped[str] = mapped_column(Text, nullable=False, default="")
    signature_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    decision: Mapped["Decision"] = relationship(back_populates="approvals")


class FieldTaskModel(Base):
    __tablename__ = "field_tasks"
    __table_args__ = (
        Index("idx_field_tasks_status", "status"),
        Index("idx_field_tasks_asset", "asset_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    task_code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    decision_id: Mapped[str] = mapped_column(
        ForeignKey("decisions.decision_id", ondelete="CASCADE"), nullable=False
    )
    incident_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fault_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    assigned_engineer: Mapped[str] = mapped_column(String(150), nullable=False)
    assigned_engineer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    assigned_team: Mapped[str] = mapped_column(String(150), nullable=False)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False)
    fault_location: Mapped[str] = mapped_column(String(255), nullable=False)
    gps_lat: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    gps_lon: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    safety_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="HIGH")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ASSIGNED")
    scheduled_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completion_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    decision: Mapped["Decision"] = relationship(back_populates="tasks")
    evidence_items: Mapped[List["Evidence"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class Evidence(Base):
    __tablename__ = "evidence"
    __table_args__ = (Index("idx_evidence_task", "task_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evidence_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    task_id: Mapped[str] = mapped_column(
        ForeignKey("field_tasks.task_id", ondelete="CASCADE"), nullable=False
    )
    decision_id: Mapped[str] = mapped_column(String(100), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    gps_lat: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    gps_lon: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    inspection_result: Mapped[str] = mapped_column(String(40), nullable=False, default="PASS")
    equipment_condition: Mapped[str] = mapped_column(String(40), nullable=False, default="GOOD")
    meter_readings: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    uploaded_by: Mapped[str] = mapped_column(String(150), nullable=False)
    uploaded_by_email: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    task: Mapped["FieldTaskModel"] = relationship(back_populates="evidence_items")


class AuditLogModel(Base):
    __tablename__ = "audit_logs_v2"
    __table_args__ = (
        Index("idx_audit_v2_action", "action_type"),
        Index("idx_audit_v2_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    actor_email: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(50), nullable=False)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    module: Mapped[str] = mapped_column(String(80), nullable=False, default="Operations")
    target_entity: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    related_asset_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    related_incident_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    change_summary: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False, default="127.0.0.1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NotificationModel(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("idx_notifications_read", "read"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notification_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="INFO")
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    related_asset_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    related_incident_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    related_decision_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    related_task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    target_view: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
