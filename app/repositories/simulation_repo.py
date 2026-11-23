from typing import List, Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.simulation import Simulation, SimulationAsset, SimulationResult


class SimulationRepository:
    """Async SQLAlchemy repository for What-If Simulations, Participating Assets, and Results."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_simulations(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Simulation]:
        stmt = (
            select(Simulation)
            .options(selectinload(Simulation.assets), selectinload(Simulation.result))
            .order_by(Simulation.created_time.desc())
            .limit(limit)
            .offset(offset)
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_by_simulation_id(self, simulation_id: str) -> Optional[Simulation]:
        stmt = (
            select(Simulation)
            .options(selectinload(Simulation.assets), selectinload(Simulation.result))
            .where(
                (Simulation.simulation_id == simulation_id)
                | (Simulation.scenario_code == simulation_id)
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_ids(self, simulation_ids: List[str]) -> Sequence[Simulation]:
        stmt = (
            select(Simulation)
            .options(selectinload(Simulation.assets), selectinload(Simulation.result))
            .where(
                (Simulation.simulation_id.in_(simulation_ids))
                | (Simulation.scenario_code.in_(simulation_ids))
            )
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def create_simulation(
        self,
        simulation: Simulation,
        assets: List[SimulationAsset],
        result: Optional[SimulationResult] = None,
    ) -> Simulation:
        self.db.add(simulation)
        for asset in assets:
            self.db.add(asset)
        if result is not None:
            self.db.add(result)
        await self.db.commit()
        refreshed = await self.get_by_simulation_id(simulation.simulation_id)
        return refreshed if refreshed is not None else simulation
