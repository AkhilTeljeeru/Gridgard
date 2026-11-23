import asyncio
from datetime import date, datetime, timezone
from typing import Dict, Tuple
from geoalchemy2.shape import from_shape
from shapely.geometry import LineString, Point, Polygon
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import AsyncSessionLocal, ensure_postgis_extension
from app.models.geography import Area, City, Country, District, State
from app.models.grid import Fault, Feeder, Substation, Transformer, UtilityAsset


def _bbox_polygon(lat: float, lon: float, half_span_deg: float = 0.04) -> Polygon:
    return Polygon(
        [
            (lon - half_span_deg, lat - half_span_deg),
            (lon + half_span_deg, lat - half_span_deg),
            (lon + half_span_deg, lat + half_span_deg),
            (lon - half_span_deg, lat + half_span_deg),
            (lon - half_span_deg, lat - half_span_deg),
        ]
    )


async def seed_indian_grid_data(session: AsyncSession) -> Dict[str, int]:
    """
    Idempotently seed Indian geographic hierarchy, substations, feeders,
    transformers, switches/breakers, utility assets, and active faults.
    Every asset uses ONE canonical ID aligned with Map, Neo4j, and Simulator.
    """
    existing = await session.execute(select(Country).where(Country.iso_code == "IN"))
    country = existing.scalar_one_or_none()
    if country is None:
        country = Country(name="India", iso_code="IN")
        session.add(country)
        await session.flush()

    # Geographic hierarchy definitions: (state_code, state_name, district, city, area, pincode, center_lat, center_lon)
    geo_specs = [
        ("TG", "Telangana", "Hyderabad", "Hyderabad", "Madhapur", "500081", 17.4482, 78.3915),
        ("KA", "Karnataka", "Bengaluru Urban", "Bengaluru", "Whitefield", "560066", 12.9698, 77.7500),
        ("MH", "Maharashtra", "Mumbai Suburban", "Mumbai", "Bandra Kurla Complex", "400051", 19.0652, 72.8682),
        ("DL", "Delhi", "New Delhi", "New Delhi", "Connaught Place", "110001", 28.6315, 77.2167),
        ("TN", "Tamil Nadu", "Chennai", "Chennai", "Guindy", "600032", 13.0067, 80.2206),
    ]

    area_lookup: Dict[str, Tuple[State, District, City, Area]] = {}

    for state_code, state_name, dist_name, city_name, area_name, pincode, c_lat, c_lon in geo_specs:
        state_obj = (
            await session.execute(select(State).where(State.state_code == state_code))
        ).scalar_one_or_none()
        if state_obj is None:
            state_obj = State(
                country_id=country.id,
                name=state_name,
                state_code=state_code,
                geometry=from_shape(_bbox_polygon(c_lat, c_lon, 1.5), srid=4326),
            )
            session.add(state_obj)
            await session.flush()

        dist_obj = (
            await session.execute(
                select(District).where(
                    District.state_id == state_obj.id,
                    District.name == dist_name,
                )
            )
        ).scalar_one_or_none()
        if dist_obj is None:
            dist_obj = District(
                state_id=state_obj.id,
                name=dist_name,
                geometry=from_shape(_bbox_polygon(c_lat, c_lon, 0.35), srid=4326),
            )
            session.add(dist_obj)
            await session.flush()

        city_obj = (
            await session.execute(
                select(City).where(
                    City.district_id == dist_obj.id,
                    City.name == city_name,
                )
            )
        ).scalar_one_or_none()
        if city_obj is None:
            city_obj = City(
                district_id=dist_obj.id,
                name=city_name,
                geometry=from_shape(_bbox_polygon(c_lat, c_lon, 0.18), srid=4326),
            )
            session.add(city_obj)
            await session.flush()

        area_obj = (
            await session.execute(
                select(Area).where(Area.city_id == city_obj.id, Area.name == area_name)
            )
        ).scalar_one_or_none()
        if area_obj is None:
            area_obj = Area(
                city_id=city_obj.id,
                name=area_name,
                pincode=pincode,
                geometry=from_shape(_bbox_polygon(c_lat, c_lon, 0.05), srid=4326),
            )
            session.add(area_obj)
            await session.flush()

        area_lookup[state_code] = (state_obj, dist_obj, city_obj, area_obj)

    # Extra Hyderabad area for Gachibowli
    tg_state, tg_dist, tg_city, _ = area_lookup["TG"]
    gachibowli_area = (
        await session.execute(
            select(Area).where(Area.city_id == tg_city.id, Area.name == "Gachibowli")
        )
    ).scalar_one_or_none()
    if gachibowli_area is None:
        gachibowli_area = Area(
            city_id=tg_city.id,
            name="Gachibowli",
            pincode="500032",
            geometry=from_shape(_bbox_polygon(17.4328, 78.3562, 0.04), srid=4326),
        )
        session.add(gachibowli_area)
        await session.flush()
    area_lookup["TG_GACHIBOWLI"] = (tg_state, tg_dist, tg_city, gachibowli_area)

    # 1. Substations
    substation_specs = [
        ("SUB-TG-06U", "Madhapur 132/33 kV EHT Substation (DEMO)", 50000.0, "132/33 kV", "TGSPDCL (Demo)", "ACTIVE", 17.4482, 78.3915, "TG"),
        ("SUB-TG-07D", "Gachibowli 33/11 kV Distribution Substation (DEMO)", 25000.0, "33/11 kV", "TGSPDCL (Demo)", "ACTIVE", 17.4328, 78.3562, "TG_GACHIBOWLI"),
        ("SUB-KA-01U", "Whitefield 66/11 kV GIS Substation (DEMO)", 40000.0, "66/11 kV", "BESCOM (Demo)", "ACTIVE", 12.9698, 77.7500, "KA"),
        ("SUB-MH-01U", "BKC 33/11 kV Receiving Station (DEMO)", 35000.0, "33/11 kV", "BEST / Adani (Demo)", "WARNING", 19.0652, 72.8682, "MH"),
        ("SUB-DL-01U", "Connaught Place 33/11 kV Grid (DEMO)", 30000.0, "33/11 kV", "NDMC / BSES (Demo)", "ACTIVE", 28.6315, 77.2167, "DL"),
        ("SUB-TN-01U", "Guindy 110/33/11 kV Substation (DEMO)", 45000.0, "110/33 kV", "TANGEDCO (Demo)", "ACTIVE", 13.0067, 80.2206, "TN"),
    ]

    substations_by_code: Dict[str, Substation] = {}
    for code, name, cap, volt, op, status_val, lat, lon, geo_key in substation_specs:
        sub = (
            await session.execute(select(Substation).where(Substation.substation_code == code))
        ).scalar_one_or_none()
        if sub is None:
            sub = Substation(
                substation_code=code,
                name=name,
                capacity=cap,
                voltage_level=volt,
                operator=op,
                status=status_val,
                latitude=lat,
                longitude=lon,
                geometry=from_shape(Point(lon, lat), srid=4326),
            )
            session.add(sub)
            await session.flush()
        substations_by_code[code] = sub

    # 2. Feeders (LineStrings)
    feeder_specs = [
        (
            "FDR-TG-06U-01",
            "HITEC City Express 11 kV Feeder 01 (DEMO)",
            "SUB-TG-06U",
            "11 kV",
            "FAULTED",
            "TGSPDCL (Demo)",
            [(78.3915, 17.4482), (78.3895, 17.4475), (78.3834, 17.4454), (78.3772, 17.4435)],
        ),
        (
            "FDR-TG-06U-02",
            "Mindspace IT Park 11 kV Feeder 02 (DEMO)",
            "SUB-TG-06U",
            "11 kV",
            "ENERGIZED",
            "TGSPDCL (Demo)",
            [(78.3915, 17.4482), (78.3858, 17.4418), (78.3802, 17.4396)],
        ),
        (
            "FDR-TG-07D-01",
            "Financial District 11 kV Feeder 01 (DEMO)",
            "SUB-TG-07D",
            "11 kV",
            "ENERGIZED",
            "TGSPDCL (Demo)",
            [(78.3562, 17.4328), (78.3548, 17.4316), (78.3504, 17.4282), (78.3472, 17.4264)],
        ),
        (
            "FDR-KA-01U-01",
            "ITPL Tech Corridor 11 kV Feeder 01 (DEMO)",
            "SUB-KA-01U",
            "11 kV",
            "FAULTED",
            "BESCOM (Demo)",
            [(77.7500, 12.9698), (77.7445, 12.9762), (77.7380, 12.9825)],
        ),
        (
            "FDR-MH-01U-01",
            "BKC Commercial Ring 11 kV Feeder 01 (DEMO)",
            "SUB-MH-01U",
            "11 kV",
            "WARNING",
            "BEST / Adani (Demo)",
            [(72.8682, 19.0652), (72.8645, 19.0680), (72.8610, 19.0705)],
        ),
        (
            "FDR-DL-01U-01",
            "Rajiv Chowk Underground 11 kV Feeder (DEMO)",
            "SUB-DL-01U",
            "11 kV",
            "ENERGIZED",
            "NDMC / BSES (Demo)",
            [(77.2167, 28.6315), (77.2205, 28.6335), (77.2240, 28.6350)],
        ),
        (
            "FDR-TN-01U-01",
            "Guindy Industrial Estate 11 kV Feeder (DEMO)",
            "SUB-TN-01U",
            "11 kV",
            "ENERGIZED",
            "TANGEDCO (Demo)",
            [(80.2206, 13.0067), (80.2160, 13.0095), (80.2120, 13.0122)],
        ),
    ]

    feeders_by_code: Dict[str, Feeder] = {}
    for f_code, f_name, sub_code, volt, status_val, op, coords in feeder_specs:
        fdr = (
            await session.execute(select(Feeder).where(Feeder.feeder_code == f_code))
        ).scalar_one_or_none()
        if fdr is None:
            fdr = Feeder(
                feeder_code=f_code,
                feeder_name=f_name,
                substation_id=substations_by_code[sub_code].id,
                voltage_level=volt,
                status=status_val,
                operator=op,
                geometry=from_shape(LineString(coords), srid=4326),
            )
            session.add(fdr)
            await session.flush()
        feeders_by_code[f_code] = fdr

    # 3. Transformers
    transformer_specs = [
        ("DTR-TG-06U-104", "Cyber Gateway 630 kVA DTR-104 (DEMO)", "FDR-TG-06U-01", 630.0, "FAULTED", "11/0.433 kV", 17.4435, 78.3772),
        ("DTR-TG-06U-108", "Mindspace Bldg-9 500 kVA DTR-108 (DEMO)", "FDR-TG-06U-02", 500.0, "ACTIVE", "11/0.433 kV", 17.4396, 78.3802),
        ("DTR-TG-07D-201", "Gachibowli Circle 315 kVA DTR-201 (DEMO)", "FDR-TG-07D-01", 315.0, "ACTIVE", "11/0.433 kV", 17.4264, 78.3472),
        ("DTR-KA-01U-301", "ITPL Gate-2 630 kVA DTR-301 (DEMO)", "FDR-KA-01U-01", 630.0, "FAULTED", "11/0.433 kV", 12.9825, 77.7380),
        ("DTR-MH-01U-401", "G-Block BKC 990 kVA DTR-401 (DEMO)", "FDR-MH-01U-01", 990.0, "WARNING", "11/0.433 kV", 19.0705, 72.8610),
        ("DTR-DL-01U-501", "Outer Circle CP 630 kVA DTR-501 (DEMO)", "FDR-DL-01U-01", 630.0, "ACTIVE", "11/0.433 kV", 28.6350, 77.2240),
        ("DTR-TN-01U-601", "SIDCO Guindy 500 kVA DTR-601 (DEMO)", "FDR-TN-01U-01", 500.0, "ACTIVE", "11/0.433 kV", 13.0122, 80.2120),
    ]

    for t_code, t_name, f_code, cap, status_val, volt, lat, lon in transformer_specs:
        tx = (
            await session.execute(select(Transformer).where(Transformer.transformer_code == t_code))
        ).scalar_one_or_none()
        if tx is None:
            tx = Transformer(
                transformer_code=t_code,
                name=t_name,
                feeder_id=feeders_by_code[f_code].id,
                capacity=cap,
                status=status_val,
                voltage_level=volt,
                latitude=lat,
                longitude=lon,
                geometry=from_shape(Point(lon, lat), srid=4326),
            )
            session.add(tx)
            await session.flush()

    # 4. Canonical UtilityAsset registry entries (covering Substations, Feeders, Breakers, Switches, Transformers)
    asset_specs = [
        ("SUB-TG-06U", "Madhapur 132/33 kV EHT Substation (DEMO)", "SUBSTATION", 17.4482, 78.3915, "132/33 kV", "ACTIVE", date(2016, 5, 12), date(2026, 10, 18), "TG", "SUB-TG-06U", None, "TGSPDCL (Demo)", 50000.0),
        ("FDR-TG-06U-01", "HITEC City Express 11 kV Feeder 01 (DEMO)", "FEEDER", 17.4454, 78.3834, "11 kV", "FAULTED", date(2018, 3, 20), date(2026, 10, 14), "TG", "SUB-TG-06U", "FDR-TG-06U-01", "TGSPDCL (Demo)", 12500.0),
        ("FDR-TG-06U-02", "Mindspace IT Park 11 kV Feeder 02 (DEMO)", "FEEDER", 17.4418, 78.3858, "11 kV", "ACTIVE", date(2019, 7, 11), date(2026, 10, 20), "TG", "SUB-TG-06U", "FDR-TG-06U-02", "TGSPDCL (Demo)", 14000.0),
        ("CB-TG-06U-01", "Madhapur Outgoing VCB-01 (DEMO)", "CIRCUIT_BREAKER", 17.4475, 78.3895, "11 kV", "FAULTED", date(2020, 2, 14), date(2026, 10, 12), "TG", "SUB-TG-06U", "FDR-TG-06U-01", "TGSPDCL (Demo)", 12500.0),
        ("SW-TG-06U-14", "Cyber Gateway RMU Tie Switch-14 (DEMO)", "SECTIONALIZER", 17.4412, 78.3792, "11 kV", "ACTIVE", date(2021, 8, 3), date(2026, 9, 29), "TG", "SUB-TG-06U", "FDR-TG-06U-01", "TGSPDCL (Demo)", 12000.0),
        ("DTR-TG-06U-104", "Cyber Gateway 630 kVA DTR-104 (DEMO)", "TRANSFORMER", 17.4435, 78.3772, "11/0.433 kV", "FAULTED", date(2021, 4, 12), date(2026, 10, 8), "TG", "SUB-TG-06U", "FDR-TG-06U-01", "TGSPDCL (Demo)", 630.0),
        ("DTR-TG-06U-108", "Mindspace Bldg-9 500 kVA DTR-108 (DEMO)", "TRANSFORMER", 17.4396, 78.3802, "11/0.433 kV", "ACTIVE", date(2022, 1, 19), date(2026, 10, 19), "TG", "SUB-TG-06U", "FDR-TG-06U-02", "TGSPDCL (Demo)", 500.0),
        ("SUB-TG-07D", "Gachibowli 33/11 kV Distribution Substation (DEMO)", "SUBSTATION", 17.4328, 78.3562, "33/11 kV", "ACTIVE", date(2017, 11, 5), date(2026, 10, 22), "TG_GACHIBOWLI", "SUB-TG-07D", None, "TGSPDCL (Demo)", 25000.0),
        ("FDR-TG-07D-01", "Financial District 11 kV Feeder 01 (DEMO)", "FEEDER", 17.4282, 78.3504, "11 kV", "ACTIVE", date(2019, 6, 18), date(2026, 10, 25), "TG_GACHIBOWLI", "SUB-TG-07D", "FDR-TG-07D-01", "TGSPDCL (Demo)", 10000.0),
        ("CB-TG-07D-01", "Gachibowli Feeder-01 VCB (DEMO)", "CIRCUIT_BREAKER", 17.4316, 78.3548, "11 kV", "ACTIVE", date(2019, 6, 18), date(2026, 10, 15), "TG_GACHIBOWLI", "SUB-TG-07D", "FDR-TG-07D-01", "TGSPDCL (Demo)", 10000.0),
        ("DTR-TG-07D-201", "Gachibowli Circle 315 kVA DTR-201 (DEMO)", "TRANSFORMER", 17.4264, 78.3472, "11/0.433 kV", "ACTIVE", date(2020, 9, 10), date(2026, 10, 1), "TG_GACHIBOWLI", "SUB-TG-07D", "FDR-TG-07D-01", "TGSPDCL (Demo)", 315.0),
        ("SUB-KA-01U", "Whitefield 66/11 kV GIS Substation (DEMO)", "SUBSTATION", 12.9698, 77.7500, "66/11 kV", "ACTIVE", date(2018, 1, 22), date(2026, 10, 11), "KA", "SUB-KA-01U", None, "BESCOM (Demo)", 40000.0),
        ("CB-KA-01U-01", "Whitefield ITPL Outgoing Breaker (DEMO)", "CIRCUIT_BREAKER", 12.9762, 77.7445, "11 kV", "FAULTED", date(2019, 4, 15), date(2026, 10, 10), "KA", "SUB-KA-01U", "FDR-KA-01U-01", "BESCOM (Demo)", 12000.0),
        ("DTR-KA-01U-301", "ITPL Gate-2 630 kVA DTR-301 (DEMO)", "TRANSFORMER", 12.9825, 77.7380, "11/0.433 kV", "FAULTED", date(2021, 5, 2), date(2026, 10, 9), "KA", "SUB-KA-01U", "FDR-KA-01U-01", "BESCOM (Demo)", 630.0),
        ("SUB-MH-01U", "BKC 33/11 kV Receiving Station (DEMO)", "SUBSTATION", 19.0652, 72.8682, "33/11 kV", "WARNING", date(2015, 8, 19), date(2026, 10, 21), "MH", "SUB-MH-01U", None, "BEST / Adani (Demo)", 35000.0),
        ("DTR-MH-01U-401", "G-Block BKC 990 kVA DTR-401 (DEMO)", "TRANSFORMER", 19.0705, 72.8610, "11/0.433 kV", "WARNING", date(2020, 11, 28), date(2026, 10, 16), "MH", "SUB-MH-01U", "FDR-MH-01U-01", "BEST / Adani (Demo)", 990.0),
        ("SUB-DL-01U", "Connaught Place 33/11 kV Grid (DEMO)", "SUBSTATION", 28.6315, 77.2167, "33/11 kV", "ACTIVE", date(2014, 3, 14), date(2026, 10, 28), "DL", "SUB-DL-01U", None, "NDMC / BSES (Demo)", 30000.0),
        ("DTR-DL-01U-501", "Outer Circle CP 630 kVA DTR-501 (DEMO)", "TRANSFORMER", 28.6350, 77.2240, "11/0.433 kV", "ACTIVE", date(2019, 12, 5), date(2026, 10, 26), "DL", "SUB-DL-01U", "FDR-DL-01U-01", "NDMC / BSES (Demo)", 630.0),
        ("SUB-TN-01U", "Guindy 110/33/11 kV Substation (DEMO)", "SUBSTATION", 13.0067, 80.2206, "110/33 kV", "ACTIVE", date(2016, 7, 30), date(2026, 10, 17), "TN", "SUB-TN-01U", None, "TANGEDCO (Demo)", 45000.0),
        ("DTR-TN-01U-601", "SIDCO Guindy 500 kVA DTR-601 (DEMO)", "TRANSFORMER", 13.0122, 80.2120, "11/0.433 kV", "ACTIVE", date(2022, 6, 9), date(2026, 10, 24), "TN", "SUB-TN-01U", "FDR-TN-01U-01", "TANGEDCO (Demo)", 500.0),
    ]

    inserted_assets = 0
    for (
        asset_id,
        asset_name,
        asset_type,
        lat,
        lon,
        volt,
        status_val,
        install_dt,
        maint_dt,
        geo_key,
        sub_code,
        fdr_code,
        operator,
        cap_kva,
    ) in asset_specs:
        existing_asset = (
            await session.execute(select(UtilityAsset).where(UtilityAsset.asset_id == asset_id))
        ).scalar_one_or_none()
        if existing_asset is None:
            st_obj, d_obj, c_obj, a_obj = area_lookup[geo_key]
            geom = (
                feeders_by_code[fdr_code].geometry
                if asset_type == "FEEDER" and fdr_code in feeders_by_code
                else from_shape(Point(lon, lat), srid=4326)
            )
            record = UtilityAsset(
                asset_id=asset_id,
                asset_name=asset_name,
                asset_type=asset_type,
                latitude=lat,
                longitude=lon,
                geometry=geom,
                voltage_level=volt,
                operational_status=status_val,
                installation_date=install_dt,
                last_maintenance=maint_dt,
                state_id=st_obj.id,
                district_id=d_obj.id,
                city_id=c_obj.id,
                area_id=a_obj.id,
                substation_id=substations_by_code[sub_code].id if sub_code in substations_by_code else None,
                feeder_id=feeders_by_code[fdr_code].id if fdr_code and fdr_code in feeders_by_code else None,
                substation_code=sub_code,
                feeder_code=fdr_code,
                operator=operator,
                rated_capacity_kva=cap_kva,
                source="DEMO",
                extra_metadata={"seeded": True, "canonical_id": asset_id},
            )
            session.add(record)
            inserted_assets += 1
    await session.flush()

    # 5. Faults
    fault_specs = [
        (
            "FLT-TG-06U-01",
            "DTR-TG-06U-104",
            "CRITICAL",
            "Overcurrent Lockout & Buchholz Gas Alarm",
            datetime(2026, 11, 16, 10, 14, 0, tzinfo=timezone.utc),
            None,
            17.4442,
            78.3812,
            "ACTIVE_LOCKOUT",
            320,
            "EVT-TG-06U-2026-01",
            "Phase-B ground fault upstream of Cyber Gateway DTR-104; VCB CB-TG-06U-01 locked out.",
        ),
        (
            "FLT-KA-01U-01",
            "DTR-KA-01U-301",
            "HIGH",
            "11 kV Underground Cable Insulation Breakdown",
            datetime(2026, 11, 16, 9, 42, 0, tzinfo=timezone.utc),
            None,
            12.9801,
            77.7412,
            "ISOLATION_IN_PROGRESS",
            280,
            "EVT-KA-01U-2026-04",
            "Earth fault differential trip on Whitefield ITPL feeder segment.",
        ),
        (
            "FLT-MH-01U-01",
            "DTR-MH-01U-401",
            "MEDIUM",
            "Transformer Winding Thermal Overload Warning",
            datetime(2026, 11, 16, 8, 55, 0, tzinfo=timezone.utc),
            None,
            19.0695,
            72.8625,
            "MONITORING",
            180,
            "EVT-MH-01U-2026-02",
            "Peak commercial cooling load exceeding 92% nameplate rating at BKC G-Block.",
        ),
    ]

    inserted_faults = 0
    for (
        f_id,
        a_id,
        sev,
        f_type,
        det_time,
        res_time,
        lat,
        lon,
        f_status,
        radius_m,
        evt_id,
        desc,
    ) in fault_specs:
        existing_fault = (
            await session.execute(select(Fault).where(Fault.fault_id == f_id))
        ).scalar_one_or_none()
        if existing_fault is None:
            session.add(
                Fault(
                    fault_id=f_id,
                    asset_id=a_id,
                    severity=sev,
                    fault_type=f_type,
                    detected_time=det_time,
                    resolved_time=res_time,
                    latitude=lat,
                    longitude=lon,
                    geometry=from_shape(Point(lon, lat), srid=4326),
                    status=f_status,
                    radius_meters=radius_m,
                    related_event_id=evt_id,
                    description=desc,
                    source="DEMO",
                )
            )
            inserted_faults += 1

    await session.commit()
    return {
        "substations": len(substations_by_code),
        "feeders": len(feeders_by_code),
        "utility_assets_inserted": inserted_assets,
        "faults_inserted": inserted_faults,
    }


async def _run_cli_seed() -> None:
    await ensure_postgis_extension()
    async with AsyncSessionLocal() as session:
        summary = await seed_indian_grid_data(session)
        print(f"[GridGuard Seed] Completed successfully: {summary}")


if __name__ == "__main__":
    asyncio.run(_run_cli_seed())
