from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import Area, City, District, State
from app.models.grid import Fault, Feeder, Substation, Transformer, UtilityAsset


class GridRepository:
    """Repository for Grid topology GeoJSON layers, unified search, and route resolution."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_substations(self, limit: int = 500, offset: int = 0) -> List[Substation]:
        stmt = select(Substation).order_by(Substation.substation_code.asc()).limit(limit).offset(offset)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_feeders(
        self,
        substation_id: Optional[int] = None,
        limit: int = 500,
        offset: int = 0,
    ) -> List[Feeder]:
        stmt = select(Feeder).order_by(Feeder.feeder_code.asc())
        if substation_id is not None:
            stmt = stmt.where(Feeder.substation_id == substation_id)
        stmt = stmt.limit(limit).offset(offset)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_transformers(
        self,
        feeder_id: Optional[int] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[Transformer]:
        stmt = select(Transformer).order_by(Transformer.transformer_code.asc())
        if feeder_id is not None:
            stmt = stmt.where(Transformer.feeder_id == feeder_id)
        stmt = stmt.limit(limit).offset(offset)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_switches(self, limit: int = 1000, offset: int = 0) -> List[UtilityAsset]:
        stmt = (
            select(UtilityAsset)
            .where(
                UtilityAsset.asset_type.in_(
                    ["SWITCH", "CIRCUIT_BREAKER", "SECTIONALIZER", "RECLOSER"]
                )
            )
            .order_by(UtilityAsset.asset_id.asc())
            .limit(limit)
            .offset(offset)
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_faults(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 500,
        offset: int = 0,
    ) -> List[Fault]:
        stmt = select(Fault).order_by(Fault.detected_time.desc())
        if status:
            stmt = stmt.where(func.upper(Fault.status) == status.strip().upper())
        if severity:
            stmt = stmt.where(func.upper(Fault.severity) == severity.strip().upper())
        stmt = stmt.limit(limit).offset(offset)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def unified_search(self, query: str, limit: int = 25) -> Dict[str, List[Any]]:
        pattern = f"%{query.strip()}%"

        assets_res = await self.session.execute(
            select(UtilityAsset)
            .where(
                or_(
                    UtilityAsset.asset_id.ilike(pattern),
                    UtilityAsset.asset_name.ilike(pattern),
                    UtilityAsset.substation_code.ilike(pattern),
                    UtilityAsset.feeder_code.ilike(pattern),
                )
            )
            .order_by(UtilityAsset.asset_id.asc())
            .limit(limit)
        )

        sub_res = await self.session.execute(
            select(Substation)
            .where(
                or_(
                    Substation.substation_code.ilike(pattern),
                    Substation.name.ilike(pattern),
                )
            )
            .limit(10)
        )

        fdr_res = await self.session.execute(
            select(Feeder)
            .where(
                or_(
                    Feeder.feeder_code.ilike(pattern),
                    Feeder.feeder_name.ilike(pattern),
                )
            )
            .limit(10)
        )

        tx_res = await self.session.execute(
            select(Transformer)
            .where(
                or_(
                    Transformer.transformer_code.ilike(pattern),
                    Transformer.name.ilike(pattern),
                )
            )
            .limit(10)
        )

        area_res = await self.session.execute(
            select(Area)
            .where(or_(Area.name.ilike(pattern), Area.pincode.ilike(pattern)))
            .limit(10)
        )
        city_res = await self.session.execute(
            select(City).where(City.name.ilike(pattern)).limit(10)
        )
        dist_res = await self.session.execute(
            select(District).where(District.name.ilike(pattern)).limit(10)
        )
        state_res = await self.session.execute(
            select(State).where(State.name.ilike(pattern)).limit(10)
        )

        return {
            "assets": list(assets_res.scalars().all()),
            "substations": list(sub_res.scalars().all()),
            "feeders": list(fdr_res.scalars().all()),
            "transformers": list(tx_res.scalars().all()),
            "areas": list(area_res.scalars().all()),
            "cities": list(city_res.scalars().all()),
            "districts": list(dist_res.scalars().all()),
            "states": list(state_res.scalars().all()),
        }

    async def get_feeder_route_context(
        self,
        feeder_code: Optional[str] = None,
        from_asset_id: Optional[str] = None,
        to_asset_id: Optional[str] = None,
    ) -> Tuple[Optional[Feeder], Optional[UtilityAsset], Optional[UtilityAsset], List[UtilityAsset]]:
        from_asset: Optional[UtilityAsset] = None
        to_asset: Optional[UtilityAsset] = None
        feeder: Optional[Feeder] = None

        if from_asset_id:
            res = await self.session.execute(
                select(UtilityAsset).where(UtilityAsset.asset_id == from_asset_id)
            )
            from_asset = res.scalar_one_or_none()
        if to_asset_id:
            res = await self.session.execute(
                select(UtilityAsset).where(UtilityAsset.asset_id == to_asset_id)
            )
            to_asset = res.scalar_one_or_none()

        target_feeder_code = feeder_code or (from_asset.feeder_code if from_asset else None) or (to_asset.feeder_code if to_asset else None)
        if target_feeder_code:
            res = await self.session.execute(
                select(Feeder).where(Feeder.feeder_code == target_feeder_code)
            )
            feeder = res.scalar_one_or_none()

        corridor_assets: List[UtilityAsset] = []
        if feeder:
            res = await self.session.execute(
                select(UtilityAsset)
                .where(
                    or_(
                        UtilityAsset.feeder_code == feeder.feeder_code,
                        UtilityAsset.feeder_id == feeder.id,
                    )
                )
                .order_by(UtilityAsset.asset_id.asc())
            )
            corridor_assets = list(res.scalars().all())

        return feeder, from_asset, to_asset, corridor_assets
