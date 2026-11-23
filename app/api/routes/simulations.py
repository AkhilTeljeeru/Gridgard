from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_db, require_roles
from app.core.security import AuthenticatedUser, UserRole
from app.schemas.simulation import (
    SimulationCompareRequest,
    SimulationCompareResponse,
    SimulationCreateRequest,
    SimulationResponse,
    SimulationResultOut,
)
from app.services.simulation_service import SimulationService

router = APIRouter(prefix="/simulations", tags=["What-If Simulations"])


@router.post(
    "",
    response_model=SimulationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and persist a What-If Simulation scenario draft",
)
async def create_simulation(
    payload: SimulationCreateRequest,
    _user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.UTILITY_MANAGER, UserRole.FIELD_ENGINEER)
    ),
    db: AsyncSession = Depends(get_db),
) -> SimulationResponse:
    service = SimulationService(db)
    return await service.create_simulation(payload, status_value="DRAFT")


@router.get(
    "",
    response_model=List[SimulationResponse],
    summary="List saved What-If Simulation scenarios",
)
async def list_simulations(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> List[SimulationResponse]:
    service = SimulationService(db)
    return await service.list_simulations(limit=pagination.limit, offset=pagination.offset)


@router.post(
    "/run",
    response_model=SimulationResponse,
    summary="Execute a What-If Simulation and return impact, risk, and recommendation",
)
async def run_simulation(
    payload: SimulationCreateRequest,
    _user: AuthenticatedUser = Depends(
        require_roles(UserRole.ADMINISTRATOR, UserRole.UTILITY_MANAGER, UserRole.FIELD_ENGINEER)
    ),
    db: AsyncSession = Depends(get_db),
) -> SimulationResponse:
    service = SimulationService(db)
    return await service.create_simulation(payload, status_value="COMPLETED")


@router.post(
    "/compare",
    response_model=SimulationCompareResponse,
    summary="Compare multiple What-If Simulation alternatives side by side",
)
async def compare_simulations(
    payload: SimulationCompareRequest,
    db: AsyncSession = Depends(get_db),
) -> SimulationCompareResponse:
    service = SimulationService(db)
    return await service.compare_simulations(payload.scenario_ids)


@router.get(
    "/{simulation_id}",
    response_model=SimulationResponse,
    summary="Retrieve a specific What-If Simulation by simulation_id or scenario_code",
)
async def get_simulation(
    simulation_id: str,
    db: AsyncSession = Depends(get_db),
) -> SimulationResponse:
    service = SimulationService(db)
    return await service.get_simulation(simulation_id)


@router.get(
    "/{simulation_id}/results",
    response_model=SimulationResultOut,
    summary="Retrieve simulation impact results, risk assessment, and advisory recommendation",
)
async def get_simulation_results(
    simulation_id: str,
    db: AsyncSession = Depends(get_db),
) -> SimulationResultOut:
    service = SimulationService(db)
    return await service.get_simulation_results(simulation_id)
