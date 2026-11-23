from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_db, require_roles
from app.core.security import AuthenticatedUser, UserRole
from app.schemas.governance import (
    ApprovalCreateRequest,
    AuditLogOut,
    DecisionCreateRequest,
    DecisionOut,
    DecisionUpdateRequest,
    EvidenceCreateRequest,
    EvidenceOut,
    FieldTaskCreateRequest,
    FieldTaskOut,
    FieldTaskUpdateRequest,
    NotificationOut,
)
from app.services.governance_service import GovernanceService

router = APIRouter(tags=["Decision Governance & Field Operations"])


@router.get(
    "/decisions",
    response_model=List[DecisionOut],
    summary="List engineering governance decisions",
)
async def list_decisions(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> List[DecisionOut]:
    service = GovernanceService(db)
    return await service.list_decisions(
        status_filter=status_filter,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post(
    "/decisions",
    response_model=DecisionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new engineering decision proposal",
)
async def create_decision(
    payload: DecisionCreateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.CONTROL_ROOM_ENGINEER,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> DecisionOut:
    service = GovernanceService(db)
    return await service.create_decision(payload, user)


@router.put(
    "/decisions/{decision_id}",
    response_model=DecisionOut,
    summary="Update or verify & close a decision with 5-point checklist",
)
async def update_decision(
    decision_id: str,
    payload: DecisionUpdateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.UTILITY_MANAGER)
    ),
    db: AsyncSession = Depends(get_db),
) -> DecisionOut:
    service = GovernanceService(db)
    return await service.update_decision(decision_id, payload, user)


@router.post(
    "/approvals",
    status_code=status.HTTP_201_CREATED,
    summary="Approve or reject a decision proposal and auto-dispatch field task",
)
async def create_approval(
    payload: ApprovalCreateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.UTILITY_MANAGER)
    ),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    service = GovernanceService(db)
    return await service.record_approval(payload, user)


@router.get(
    "/tasks",
    response_model=List[FieldTaskOut],
    summary="List field operation inspection & execution tasks",
)
async def list_tasks(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> List[FieldTaskOut]:
    service = GovernanceService(db)
    return await service.list_tasks(
        status_filter=status_filter,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post(
    "/tasks",
    response_model=FieldTaskOut,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a new field task from an approved decision",
)
async def create_task(
    payload: FieldTaskCreateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.UTILITY_MANAGER)
    ),
    db: AsyncSession = Depends(get_db),
) -> FieldTaskOut:
    service = GovernanceService(db)
    return await service.create_task(payload, user)


@router.put(
    "/tasks/{task_id}",
    response_model=FieldTaskOut,
    summary="Update field task status (Start/Pause/Complete) or crew assignment",
)
async def update_task(
    task_id: str,
    payload: FieldTaskUpdateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.UTILITY_MANAGER,
            UserRole.FIELD_ENGINEER,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> FieldTaskOut:
    service = GovernanceService(db)
    return await service.update_task(task_id, payload, user)


@router.post(
    "/evidence",
    response_model=EvidenceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload field inspection photo/PDF metadata and meter readings",
)
async def upload_evidence(
    payload: EvidenceCreateRequest,
    user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.FIELD_ENGINEER)
    ),
    db: AsyncSession = Depends(get_db),
) -> EvidenceOut:
    service = GovernanceService(db)
    return await service.upload_evidence(payload, user)


@router.get(
    "/evidence/{task_id}",
    response_model=List[EvidenceOut],
    summary="List uploaded evidence records for a field task",
)
async def list_task_evidence(
    task_id: str,
    db: AsyncSession = Depends(get_db),
) -> List[EvidenceOut]:
    service = GovernanceService(db)
    return await service.list_evidence(task_id)


@router.get(
    "/audit",
    response_model=List[AuditLogOut],
    summary="Read immutable audit trail logs",
)
async def list_audit_logs(
    action_type: Optional[str] = Query(default=None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> List[AuditLogOut]:
    service = GovernanceService(db)
    return await service.list_audits(
        action_type=action_type,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get(
    "/notifications",
    response_model=List[NotificationOut],
    summary="List operational notifications",
)
async def list_notifications(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> List[NotificationOut]:
    service = GovernanceService(db)
    return await service.list_notifications(
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post(
    "/notifications/{notification_id}/read",
    response_model=NotificationOut,
    summary="Mark a notification as read",
)
async def mark_notification_read(
    notification_id: str,
    _user: AuthenticatedUser = Depends(
        require_roles(
            UserRole.ADMINISTRATOR,
            UserRole.UTILITY_MANAGER,
            UserRole.CONTROL_ROOM_ENGINEER,
            UserRole.FIELD_ENGINEER,
            UserRole.VIEWER,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> NotificationOut:
    service = GovernanceService(db)
    return await service.mark_notification_read(notification_id)
