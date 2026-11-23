from datetime import datetime, timezone
from typing import Any, Dict, List
import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.simulation import Simulation, SimulationAsset, SimulationResult
from app.repositories.simulation_repo import SimulationRepository
from app.schemas.simulation import (
    SimulationCompareResponse,
    SimulationComparisonRow,
    SimulationCreateRequest,
    SimulationResponse,
    SimulationResultOut,
    SimulationRiskLevelEnum,
    SimulationTypeEnum,
)


class SimulationService:
    """Phase 5 advisory-only What-If Simulation & Decision Intelligence service."""

    def __init__(self, db: AsyncSession) -> None:
        self.repo = SimulationRepository(db)

    def _compute_evaluation(
        self, payload: SimulationCreateRequest, sim_id: str, scenario_code: str
    ) -> Dict[str, Any]:
        target_cap_mva = 14.0
        target_pre_mva = 6.2
        transfer_mva = float(payload.transferred_load_mva)

        is_isolation = payload.scenario_type == SimulationTypeEnum.TRANSFORMER_ISOLATION
        is_maintenance = payload.scenario_type == SimulationTypeEnum.PLANNED_MAINTENANCE

        target_post_mva = (
            round(target_pre_mva + transfer_mva * 0.35, 2)
            if is_isolation
            else round(target_pre_mva + transfer_mva, 2)
        )
        post_pct = round((target_post_mva / target_cap_mva) * 100.0, 1)
        min_voltage = round(max(0.88, min(1.02, 1.0 - (target_post_mva / target_cap_mva) * 0.055)), 3)
        thermal_violation = target_post_mva > target_cap_mva
        voltage_violation = min_voltage < 0.95

        if thermal_violation or voltage_violation:
            risk_level = SimulationRiskLevelEnum.HIGH
            risk_reasons = [
                f"Target feeder {payload.target_feeder_id} reaches {target_post_mva:.2f} MVA ({post_pct}%), approaching or exceeding thermal bounds.",
                f"Minimum bus voltage estimated at {min_voltage:.3f} p.u. (ANSI C84.1 lower limit: 0.950 p.u.).",
            ]
        elif post_pct >= 78.0 or is_isolation or (is_maintenance and payload.expected_duration_min >= 45):
            risk_level = SimulationRiskLevelEnum.MEDIUM
            risk_reasons = [
                f"Target feeder {payload.target_feeder_id} operates at {post_pct}% utilization post-transfer ({target_cap_mva - target_post_mva:.2f} MVA headroom).",
                f"Estimated outage/switching window is {payload.expected_duration_min} minutes.",
            ]
        else:
            risk_level = SimulationRiskLevelEnum.LOW
            risk_reasons = [
                f"Alternative feeder {payload.target_feeder_id} retains {target_cap_mva - target_post_mva:.2f} MVA spare headroom ({post_pct}% utilization).",
                f"Bus voltage stays nominal at {min_voltage:.3f} p.u. with no thermal overloads.",
            ]

        consumers_before = 1280
        consumers_after = (
            int(round(consumers_before * 0.48))
            if is_isolation
            else int(round(consumers_before * max(0.0, 1.0 - payload.load_transfer_pct / 100.0)))
        )
        consumers_restored = max(0, consumers_before - consumers_after)

        recommendation_text = (
            f"Hold transfer via {payload.tie_switch_id}; reduce load block from {payload.source_feeder_id}."
            if (thermal_violation or voltage_violation)
            else f"Transfer {transfer_mva:.2f} MVA ({payload.load_transfer_pct:.0f}%) from {payload.source_feeder_id} to {payload.target_feeder_id} via {payload.tie_switch_id}."
        )

        recommendation_reasons = [
            f"Target feeder headroom: {target_cap_mva - target_post_mva:.2f} MVA post-operation",
            f"Estimated consumer restoration: {consumers_restored} customers",
            f"Estimated restoration duration: {payload.expected_duration_min} minutes",
        ]

        switching_sequence = [
            f"Verify protection lockout and crew clearance on {payload.source_feeder_id}",
            f"Confirm {payload.target_feeder_id} spare capacity ({target_cap_mva - target_pre_mva:.2f} MVA)",
            f"Coordinate field switching on {payload.tie_switch_id} (advisory — human sign-off required)",
        ]

        return {
            "simulation_id": sim_id,
            "scenario_code": scenario_code,
            "risk_level": risk_level,
            "risk_reasons": risk_reasons,
            "consumers_affected": consumers_after,
            "consumers_affected_before": consumers_before,
            "consumers_restored": consumers_restored,
            "transformers_affected": 1 if payload.transformer_id else 0,
            "feeders_affected": 2 if payload.target_feeder_id != payload.source_feeder_id else 1,
            "load_distribution": {
                "targetFeederCapacityMva": target_cap_mva,
                "targetFeederPreLoadMva": target_pre_mva,
                "targetFeederPostLoadMva": target_post_mva,
                "postLoadPct": post_pct,
                "transferredLoadMva": transfer_mva,
            },
            "estimated_duration": payload.expected_duration_min,
            "min_bus_voltage_pu": min_voltage,
            "thermal_violation": thermal_violation,
            "voltage_violation": voltage_violation,
            "recommendation": recommendation_text,
            "recommendation_reasons": recommendation_reasons,
            "switching_sequence": switching_sequence,
            "map_overlay": {
                "simulationId": sim_id,
                "scenarioCode": scenario_code,
                "scenarioType": payload.scenario_type.value,
                "sourceFeederId": payload.source_feeder_id,
                "targetFeederId": payload.target_feeder_id,
                "tieSwitchId": payload.tie_switch_id,
                "isolatedAssetIds": [payload.transformer_id] if (is_isolation and payload.transformer_id) else [],
                "riskLevel": risk_level.value,
            },
        }

    def _build_asset_rows(self, sim_id: str, payload: SimulationCreateRequest) -> List[SimulationAsset]:
        rows: List[SimulationAsset] = []
        if payload.substation_id:
            rows.append(
                SimulationAsset(
                    simulation_id=sim_id,
                    asset_id=payload.substation_id,
                    role="SUBSTATION",
                    asset_type="SUBSTATION",
                    source=payload.source,
                )
            )
        rows.append(
            SimulationAsset(
                simulation_id=sim_id,
                asset_id=payload.source_feeder_id,
                role="SOURCE",
                asset_type="FEEDER",
                source=payload.source,
            )
        )
        if payload.target_feeder_id:
            rows.append(
                SimulationAsset(
                    simulation_id=sim_id,
                    asset_id=payload.target_feeder_id,
                    role="TARGET",
                    asset_type="FEEDER",
                    source=payload.source,
                )
            )
        if payload.transformer_id:
            rows.append(
                SimulationAsset(
                    simulation_id=sim_id,
                    asset_id=payload.transformer_id,
                    role=(
                        "ISOLATED"
                        if payload.scenario_type == SimulationTypeEnum.TRANSFORMER_ISOLATION
                        else "AFFECTED"
                    ),
                    asset_type="TRANSFORMER",
                    source=payload.source,
                )
            )
        rows.append(
            SimulationAsset(
                simulation_id=sim_id,
                asset_id=payload.tie_switch_id,
                role="SWITCH",
                asset_type="SECTIONALIZER",
                source=payload.source,
            )
        )
        return rows

    async def create_simulation(
        self, payload: SimulationCreateRequest, status_value: str = "DRAFT"
    ) -> SimulationResponse:
        sim_id = f"SCEN-{uuid.uuid4().hex[:10].upper()}"
        scenario_code = f"SCEN-2026-{uuid.uuid4().hex[:4].upper()}"
        eval_data = self._compute_evaluation(payload, sim_id, scenario_code)

        sim = Simulation(
            simulation_id=sim_id,
            scenario_code=scenario_code,
            title=payload.title
            or f"{payload.scenario_type.value}: {payload.source_feeder_id} -> {payload.target_feeder_id}",
            engineer_id=payload.engineer_id,
            scenario_type=payload.scenario_type.value,
            status=status_value,
            substation_id=payload.substation_id,
            source_feeder_id=payload.source_feeder_id,
            target_feeder_id=payload.target_feeder_id,
            transformer_id=payload.transformer_id,
            tie_switch_id=payload.tie_switch_id,
            load_transfer_pct=payload.load_transfer_pct,
            transferred_load_mva=payload.transferred_load_mva,
            expected_duration_min=payload.expected_duration_min,
            time_of_operation=payload.time_of_operation or datetime.now(timezone.utc),
            incident_id=payload.incident_id,
            fault_id=payload.fault_id,
            source=payload.source,
            advisory_only=True,
        )
        assets = self._build_asset_rows(sim_id, payload)
        result = SimulationResult(
            simulation_id=sim_id,
            risk_level=eval_data["risk_level"].value,
            risk_reasons=eval_data["risk_reasons"],
            consumers_affected=eval_data["consumers_affected"],
            consumers_affected_before=eval_data["consumers_affected_before"],
            consumers_restored=eval_data["consumers_restored"],
            transformers_affected=eval_data["transformers_affected"],
            feeders_affected=eval_data["feeders_affected"],
            load_distribution=eval_data["load_distribution"],
            estimated_duration=eval_data["estimated_duration"],
            min_bus_voltage_pu=eval_data["min_bus_voltage_pu"],
            thermal_violation=eval_data["thermal_violation"],
            voltage_violation=eval_data["voltage_violation"],
            recommendation=eval_data["recommendation"],
            recommendation_reasons=eval_data["recommendation_reasons"],
            switching_sequence=eval_data["switching_sequence"],
            map_overlay=eval_data["map_overlay"],
            advisory_only=True,
        )
        saved = await self.repo.create_simulation(sim, assets, result)
        return SimulationResponse.model_validate(saved)

    async def list_simulations(self, limit: int = 100, offset: int = 0) -> List[SimulationResponse]:
        sims = await self.repo.list_simulations(limit=limit, offset=offset)
        return [SimulationResponse.model_validate(s) for s in sims]

    async def get_simulation(self, simulation_id: str) -> SimulationResponse:
        sim = await self.repo.get_by_simulation_id(simulation_id)
        if sim is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation '{simulation_id}' not found.",
            )
        return SimulationResponse.model_validate(sim)

    async def get_simulation_results(self, simulation_id: str) -> SimulationResultOut:
        sim = await self.repo.get_by_simulation_id(simulation_id)
        if sim is None or sim.result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation results for '{simulation_id}' not found.",
            )
        return SimulationResultOut.model_validate(sim.result)

    async def compare_simulations(self, scenario_ids: List[str]) -> SimulationCompareResponse:
        sims = await self.repo.get_by_ids(scenario_ids)
        if not sims:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No matching simulation scenarios found for comparison.",
            )

        risk_weight = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
        rows: List[SimulationComparisonRow] = []
        for s in sims:
            res = s.result
            load_dist = res.load_distribution if res else {}
            rows.append(
                SimulationComparisonRow(
                    simulation_id=s.simulation_id,
                    scenario_code=s.scenario_code,
                    scenario_type=SimulationTypeEnum(s.scenario_type),
                    risk_level=SimulationRiskLevelEnum(res.risk_level if res else "MEDIUM"),
                    post_load_pct=float(load_dist.get("postLoadPct", 65.0)),
                    min_bus_voltage_pu=float(res.min_bus_voltage_pu) if res else 0.98,
                    consumers_affected_after=res.consumers_affected if res else None,
                    expected_outage_duration_min=s.expected_duration_min,
                    thermal_violation=bool(res.thermal_violation) if res else False,
                    voltage_violation=bool(res.voltage_violation) if res else False,
                )
            )

        best = sorted(
            rows,
            key=lambda r: (
                risk_weight.get(r.risk_level.value, 1),
                r.consumers_affected_after if r.consumers_affected_after is not None else 999999,
                r.expected_outage_duration_min,
            ),
        )[0]

        return SimulationCompareResponse(
            scenario_ids=[r.simulation_id for r in rows],
            recommended_scenario_id=best.simulation_id,
            summary=(
                f"{best.scenario_code} ({best.scenario_type.value}) offers the lowest risk "
                f"({best.risk_level.value}) at {best.post_load_pct:.1f}% post-transfer utilization."
            ),
            rows=rows,
        )
