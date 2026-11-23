from datetime import datetime, timedelta, timezone
import hashlib
from typing import Any, Dict, List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthenticatedUser
from app.models.governance import (
    Approval,
    AuditLogModel,
    Decision,
    Evidence,
    FieldTaskModel,
    NotificationModel,
)
from app.repositories.governance_repo import GovernanceRepository
from app.schemas.governance import (
    ApprovalCreateRequest,
    ApprovalOut,
    AuditLogOut,
    DecisionCreateRequest,
    DecisionOut,
    DecisionStatusEnum,
    DecisionUpdateRequest,
    EvidenceCreateRequest,
    EvidenceOut,
    FieldTaskCreateRequest,
    FieldTaskOut,
    FieldTaskStatusEnum,
    FieldTaskUpdateRequest,
    NotificationOut,
)


def _digest(seed: str) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


class GovernanceService:
    """Service layer enforcing RBAC, separation of duties, 5-point verification, and audit logging."""

    def __init__(self, db: AsyncSession) -> None:
        self.repo = GovernanceRepository(db)

    async def _record_audit(
        self,
        user: AuthenticatedUser,
        action_type: str,
        module: str,
        target_entity: str,
        entity_id: str,
        summary: str,
        related_asset_id: Optional[str] = None,
        related_incident_id: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
    ) -> None:
        entry = AuditLogModel(
            audit_id=f"AUD-{uuid.uuid4().hex[:12].upper()}",
            actor_email=user.email,
            actor_role=user.role.value,
            action_type=action_type,
            module=module,
            target_entity=target_entity,
            entity_id=entity_id,
            related_asset_id=related_asset_id,
            related_incident_id=related_incident_id,
            change_summary=summary,
            metadata_json=metadata_json or {},
        )
        await self.repo.save_audit(entry)

    async def list_decisions(
        self,
        status_filter: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[DecisionOut]:
        rows = await self.repo.list_decisions(status=status_filter, limit=limit, offset=offset)
        return [DecisionOut.model_validate(r) for r in rows]

    async def create_decision(
        self,
        payload: DecisionCreateRequest,
        user: AuthenticatedUser,
    ) -> DecisionOut:
        dec_id = payload.decision_id or f"DEC-{uuid.uuid4().hex[:10].upper()}"
        dec_code = payload.decision_code or f"DEC-2026-{uuid.uuid4().hex[:6].upper()}"
        dec = Decision(
            decision_id=dec_id,
            decision_code=dec_code,
            incident_id=payload.incident_id,
            fault_id=payload.fault_id,
            title=payload.title,
            rationale=payload.rationale,
            risk_assessment=payload.risk_assessment,
            recommendation_summary=payload.recommendation_summary or payload.title,
            target_asset_id=payload.target_asset_id,
            priority=payload.priority.value,
            risk_level=payload.risk_level,
            state=payload.state,
            district=payload.district,
            area=payload.area,
            proposed_by=user.full_name,
            proposed_by_email=user.email,
            status=DecisionStatusEnum.PENDING_REVIEW.value,
            source="DEMO",
            evidence_bundle=payload.evidence_bundle,
            digital_signature_hash=_digest(f"{dec_id}:{user.email}:{datetime.now(timezone.utc).isoformat()}"),
        )
        saved = await self.repo.save_decision(dec)
        await self._record_audit(
            user=user,
            action_type="DECISION_SUBMITTED",
            module="Decision Governance",
            target_entity="decisions",
            entity_id=saved.decision_id,
            summary=f"Submitted decision {saved.decision_code} for {saved.target_asset_id}.",
            related_asset_id=saved.target_asset_id,
            related_incident_id=saved.incident_id,
        )
        return DecisionOut.model_validate(saved)

    async def update_decision(
        self,
        decision_id: str,
        payload: DecisionUpdateRequest,
        user: AuthenticatedUser,
    ) -> DecisionOut:
        dec = await self.repo.get_decision(decision_id)
        if dec is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision '{decision_id}' not found.",
            )
        if payload.status == DecisionStatusEnum.CLOSED:
            if not payload.verification_checklist or not payload.verification_checklist.is_complete():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All 5 verification checklist items must be confirmed before closing a decision.",
                )
            checklist_dict = payload.verification_checklist.model_dump(mode="json")
            checklist_dict["verified_by"] = user.full_name
            checklist_dict["verified_at"] = datetime.now(timezone.utc).isoformat()
            dec.verification_checklist = checklist_dict
            dec.closed_by = user.full_name
            dec.closed_at = datetime.now(timezone.utc)

        if payload.status is not None:
            dec.status = payload.status.value
        if payload.escalated is not None:
            dec.escalated = payload.escalated
        if payload.resolution_summary is not None:
            dec.resolution_summary = payload.resolution_summary

        saved = await self.repo.save_decision(dec)
        if payload.status == DecisionStatusEnum.CLOSED:
            await self._record_audit(
                user=user,
                action_type="INCIDENT_CLOSED",
                module="Decision Governance",
                target_entity="decisions",
                entity_id=saved.decision_id,
                summary=f"Verified 5-point checklist and closed decision {saved.decision_code}.",
                related_asset_id=saved.target_asset_id,
                related_incident_id=saved.incident_id,
            )
        return DecisionOut.model_validate(saved)

    async def record_approval(
        self,
        payload: ApprovalCreateRequest,
        user: AuthenticatedUser,
    ) -> Dict[str, Any]:
        dec = await self.repo.get_decision(payload.decision_id)
        if dec is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision '{payload.decision_id}' not found.",
            )
        if dec.proposed_by_email == user.email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Separation of duties violation: proposer cannot approve their own decision.",
            )

        sig = _digest(f"{dec.decision_id}:{user.email}:{payload.action}:{datetime.now(timezone.utc).isoformat()}")
        approval = Approval(
            approval_id=f"APR-{uuid.uuid4().hex[:10].upper()}",
            decision_id=dec.decision_id,
            action=payload.action,
            approver_name=user.full_name,
            approver_email=user.email,
            approver_role=user.role.value,
            comments=payload.comments,
            signature_hash=sig,
        )
        saved_approval = await self.repo.save_approval(approval)

        dec.reviewed_by = user.full_name
        dec.reviewed_by_email = user.email
        dec.status = (
            DecisionStatusEnum.IN_PROGRESS.value
            if payload.action == "APPROVED"
            else DecisionStatusEnum.REJECTED.value
        )
        await self.repo.save_decision(dec)

        created_task_out: Optional[FieldTaskOut] = None
        if payload.action == "APPROVED":
            task_id = f"TSK-{uuid.uuid4().hex[:10].upper()}"
            task = FieldTaskModel(
                task_id=task_id,
                task_code=task_id,
                decision_id=dec.decision_id,
                incident_id=dec.incident_id,
                fault_id=dec.fault_id,
                title=f"Execute Approved Action ({dec.decision_code}): {dec.target_asset_id}",
                assigned_engineer=payload.assigned_engineer or "Rohan Kulkarni (Field Engineer)",
                assigned_engineer_email=payload.assigned_engineer_email or "r.kulkarni@utilitygrid.org",
                assigned_team=payload.assigned_team or f"{dec.district} Rapid Response Crew-01",
                asset_id=dec.target_asset_id,
                fault_location=f"{dec.area}, {dec.district}, {dec.state}",
                gps_lat=17.4435,
                gps_lon=78.3772,
                safety_notes="Verify lockout/tagout zero-energy state and PPE clearance.",
                priority=payload.priority.value,
                status=FieldTaskStatusEnum.ASSIGNED.value,
                due_date=datetime.now(timezone.utc) + timedelta(hours=3),
                source="DEMO",
            )
            saved_task = await self.repo.save_task(task)
            created_task_out = FieldTaskOut.model_validate(saved_task)

        await self._record_audit(
            user=user,
            action_type="DECISION_APPROVED" if payload.action == "APPROVED" else "DECISION_REJECTED",
            module="Decision Governance",
            target_entity="decisions",
            entity_id=dec.decision_id,
            summary=f"{payload.action} decision {dec.decision_code}: {payload.comments}",
            related_asset_id=dec.target_asset_id,
            related_incident_id=dec.incident_id,
        )
        return {
            "approval": ApprovalOut.model_validate(saved_approval),
            "task": created_task_out,
        }

    async def list_tasks(
        self,
        status_filter: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[FieldTaskOut]:
        rows = await self.repo.list_tasks(status=status_filter, limit=limit, offset=offset)
        return [FieldTaskOut.model_validate(r) for r in rows]

    async def create_task(
        self,
        payload: FieldTaskCreateRequest,
        user: AuthenticatedUser,
    ) -> FieldTaskOut:
        dec = await self.repo.get_decision(payload.decision_id)
        if dec is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Linked decision '{payload.decision_id}' not found.",
            )
        task_id = f"TSK-{uuid.uuid4().hex[:10].upper()}"
        task = FieldTaskModel(
            task_id=task_id,
            task_code=task_id,
            decision_id=dec.decision_id,
            incident_id=dec.incident_id,
            fault_id=dec.fault_id,
            title=payload.title or f"Field Inspection: {payload.asset_id}",
            assigned_engineer=payload.assigned_engineer,
            assigned_engineer_email=payload.assigned_engineer_email,
            assigned_team=payload.assigned_team,
            asset_id=payload.asset_id,
            fault_location=payload.fault_location,
            gps_lat=payload.gps_lat,
            gps_lon=payload.gps_lon,
            safety_notes=payload.safety_notes,
            priority=payload.priority.value,
            status=FieldTaskStatusEnum.ASSIGNED.value,
            due_date=payload.due_date,
            source="DEMO",
        )
        saved = await self.repo.save_task(task)
        await self._record_audit(
            user=user,
            action_type="FIELD_TASK_ASSIGNED",
            module="Field Operations",
            target_entity="field_tasks",
            entity_id=saved.task_id,
            summary=f"Assigned task {saved.task_code} to {saved.assigned_engineer}.",
            related_asset_id=saved.asset_id,
            related_incident_id=saved.incident_id,
        )
        return FieldTaskOut.model_validate(saved)

    async def update_task(
        self,
        task_id: str,
        payload: FieldTaskUpdateRequest,
        user: AuthenticatedUser,
    ) -> FieldTaskOut:
        task = await self.repo.get_task(task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Field task '{task_id}' not found.",
            )
        if payload.status is not None:
            task.status = payload.status.value
        if payload.assigned_engineer is not None:
            task.assigned_engineer = payload.assigned_engineer
        if payload.assigned_engineer_email is not None:
            task.assigned_engineer_email = payload.assigned_engineer_email
        if payload.assigned_team is not None:
            task.assigned_team = payload.assigned_team
        if payload.priority is not None:
            task.priority = payload.priority.value
        if payload.due_date is not None:
            task.due_date = payload.due_date
        if payload.completion_notes is not None:
            task.completion_notes = payload.completion_notes

        saved = await self.repo.save_task(task)
        await self._record_audit(
            user=user,
            action_type="FIELD_TASK_UPDATED",
            module="Field Operations",
            target_entity="field_tasks",
            entity_id=saved.task_id,
            summary=f"Updated task {saved.task_code} status to {saved.status}.",
            related_asset_id=saved.asset_id,
            related_incident_id=saved.incident_id,
        )
        return FieldTaskOut.model_validate(saved)

    async def upload_evidence(
        self,
        payload: EvidenceCreateRequest,
        user: AuthenticatedUser,
    ) -> EvidenceOut:
        task = await self.repo.get_task(payload.task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Field task '{payload.task_id}' not found.",
            )
        ev = Evidence(
            evidence_id=f"EVD-{uuid.uuid4().hex[:10].upper()}",
            task_id=task.task_id,
            decision_id=payload.decision_id or task.decision_id,
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
            source="DEMO",
        )
        saved = await self.repo.save_evidence(ev)
        await self._record_audit(
            user=user,
            action_type="EVIDENCE_UPLOADED",
            module="Field Operations",
            target_entity="evidence",
            entity_id=saved.evidence_id,
            summary=f"Uploaded field evidence {saved.file_name} for {task.task_code}.",
            related_asset_id=task.asset_id,
            related_incident_id=task.incident_id,
        )
        return EvidenceOut.model_validate(saved)

    async def list_evidence(self, task_id: str) -> List[EvidenceOut]:
        rows = await self.repo.list_evidence_by_task(task_id)
        return [EvidenceOut.model_validate(r) for r in rows]

    async def list_audits(
        self,
        action_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLogOut]:
        rows = await self.repo.list_audits(action_type=action_type, limit=limit, offset=offset)
        return [AuditLogOut.model_validate(r) for r in rows]

    async def list_notifications(self, limit: int = 50, offset: int = 0) -> List[NotificationOut]:
        rows = await self.repo.list_notifications(limit=limit, offset=offset)
        return [NotificationOut.model_validate(r) for r in rows]

    async def mark_notification_read(self, notification_id: str) -> NotificationOut:
        notif = await self.repo.get_notification(notification_id)
        if notif is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Notification '{notification_id}' not found.",
            )
        notif.read = True
        saved = await self.repo.save_notification(notif)
        return NotificationOut.model_validate(saved)
