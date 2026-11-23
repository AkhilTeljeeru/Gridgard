"""Phase 3 initial PostGIS geography and utility grid schema

Revision ID: 20261116_0001
Revises:
Create Date: 2026-11-16 00:01:00.000000
"""
from typing import Sequence, Union

from alembic import op
import geoalchemy2
import sqlalchemy as sa

revision: str = "20261116_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    op.create_table(
        "countries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("iso_code", sa.String(length=8), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("iso_code"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_countries_iso_code"), "countries", ["iso_code"], unique=True)

    op.create_table(
        "states",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("country_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("state_code", sa.String(length=16), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="POLYGON",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["country_id"], ["countries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("state_code"),
    )
    op.create_index("idx_states_country_name", "states", ["country_id", "name"], unique=False)
    op.create_index("idx_states_geometry", "states", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index(op.f("ix_states_country_id"), "states", ["country_id"], unique=False)
    op.create_index(op.f("ix_states_name"), "states", ["name"], unique=False)
    op.create_index(op.f("ix_states_state_code"), "states", ["state_code"], unique=True)

    op.create_table(
        "districts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("state_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="POLYGON",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["state_id"], ["states.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_districts_geometry", "districts", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index("idx_districts_state_name", "districts", ["state_id", "name"], unique=False)
    op.create_index(op.f("ix_districts_name"), "districts", ["name"], unique=False)
    op.create_index(op.f("ix_districts_state_id"), "districts", ["state_id"], unique=False)

    op.create_table(
        "cities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("district_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="POLYGON",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["district_id"], ["districts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_cities_district_name", "cities", ["district_id", "name"], unique=False)
    op.create_index("idx_cities_geometry", "cities", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index(op.f("ix_cities_district_id"), "cities", ["district_id"], unique=False)
    op.create_index(op.f("ix_cities_name"), "cities", ["name"], unique=False)

    op.create_table(
        "areas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("city_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("pincode", sa.String(length=16), nullable=True),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="POLYGON",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["city_id"], ["cities.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_areas_city_pincode", "areas", ["city_id", "pincode"], unique=False)
    op.create_index("idx_areas_geometry", "areas", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index(op.f("ix_areas_city_id"), "areas", ["city_id"], unique=False)
    op.create_index(op.f("ix_areas_name"), "areas", ["name"], unique=False)
    op.create_index(op.f("ix_areas_pincode"), "areas", ["pincode"], unique=False)

    op.create_table(
        "substations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("substation_code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("capacity", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("voltage_level", sa.String(length=50), nullable=True),
        sa.Column("operator", sa.String(length=150), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_substations_geometry", "substations", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index(op.f("ix_substations_name"), "substations", ["name"], unique=False)
    op.create_index(op.f("ix_substations_substation_code"), "substations", ["substation_code"], unique=True)

    op.create_table(
        "feeders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("feeder_code", sa.String(length=100), nullable=False),
        sa.Column("feeder_name", sa.String(length=200), nullable=False),
        sa.Column("substation_id", sa.Integer(), nullable=True),
        sa.Column("voltage_level", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("operator", sa.String(length=150), nullable=True),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="LINESTRING",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["substation_id"], ["substations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_feeders_geometry", "feeders", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index(op.f("ix_feeders_feeder_code"), "feeders", ["feeder_code"], unique=True)
    op.create_index(op.f("ix_feeders_feeder_name"), "feeders", ["feeder_name"], unique=False)
    op.create_index(op.f("ix_feeders_substation_id"), "feeders", ["substation_id"], unique=False)

    op.create_table(
        "transformers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("transformer_code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("feeder_id", sa.Integer(), nullable=True),
        sa.Column("capacity", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("voltage_level", sa.String(length=50), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["feeder_id"], ["feeders.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_transformers_geometry", "transformers", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index(op.f("ix_transformers_feeder_id"), "transformers", ["feeder_id"], unique=False)
    op.create_index(op.f("ix_transformers_status"), "transformers", ["status"], unique=False)
    op.create_index(op.f("ix_transformers_transformer_code"), "transformers", ["transformer_code"], unique=True)

    op.create_table(
        "utility_assets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("asset_name", sa.String(length=200), nullable=False),
        sa.Column("asset_type", sa.String(length=60), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=False,
        ),
        sa.Column("voltage_level", sa.String(length=50), nullable=True),
        sa.Column("operational_status", sa.String(length=40), nullable=False),
        sa.Column("installation_date", sa.Date(), nullable=True),
        sa.Column("last_maintenance", sa.Date(), nullable=True),
        sa.Column("state_id", sa.Integer(), nullable=False),
        sa.Column("district_id", sa.Integer(), nullable=False),
        sa.Column("city_id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("feeder_id", sa.Integer(), nullable=True),
        sa.Column("substation_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("operator", sa.String(length=150), nullable=True),
        sa.Column("rated_capacity_kva", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("substation_code", sa.String(length=100), nullable=True),
        sa.Column("feeder_code", sa.String(length=100), nullable=True),
        sa.Column("extra_metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["city_id"], ["cities.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["district_id"], ["districts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["feeder_id"], ["feeders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["state_id"], ["states.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["substation_id"], ["substations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_utility_assets_geometry", "utility_assets", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index(
        "idx_utility_assets_hierarchy",
        "utility_assets",
        ["state_id", "district_id", "city_id", "area_id"],
        unique=False,
    )
    op.create_index(
        "idx_utility_assets_type_status",
        "utility_assets",
        ["asset_type", "operational_status"],
        unique=False,
    )
    op.create_index(op.f("ix_utility_assets_area_id"), "utility_assets", ["area_id"], unique=False)
    op.create_index(op.f("ix_utility_assets_asset_id"), "utility_assets", ["asset_id"], unique=True)
    op.create_index(op.f("ix_utility_assets_asset_name"), "utility_assets", ["asset_name"], unique=False)
    op.create_index(op.f("ix_utility_assets_asset_type"), "utility_assets", ["asset_type"], unique=False)
    op.create_index(op.f("ix_utility_assets_city_id"), "utility_assets", ["city_id"], unique=False)
    op.create_index(op.f("ix_utility_assets_district_id"), "utility_assets", ["district_id"], unique=False)
    op.create_index(op.f("ix_utility_assets_feeder_code"), "utility_assets", ["feeder_code"], unique=False)
    op.create_index(op.f("ix_utility_assets_feeder_id"), "utility_assets", ["feeder_id"], unique=False)
    op.create_index(op.f("ix_utility_assets_operational_status"), "utility_assets", ["operational_status"], unique=False)
    op.create_index(op.f("ix_utility_assets_state_id"), "utility_assets", ["state_id"], unique=False)
    op.create_index(op.f("ix_utility_assets_substation_code"), "utility_assets", ["substation_code"], unique=False)
    op.create_index(op.f("ix_utility_assets_substation_id"), "utility_assets", ["substation_id"], unique=False)
    op.create_index(op.f("ix_utility_assets_voltage_level"), "utility_assets", ["voltage_level"], unique=False)

    op.create_table(
        "faults",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fault_id", sa.String(length=100), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.String(length=30), nullable=False),
        sa.Column("fault_type", sa.String(length=120), nullable=False),
        sa.Column("detected_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("radius_meters", sa.Integer(), nullable=False),
        sa.Column("related_event_id", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["utility_assets.asset_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_faults_geometry", "faults", ["geometry"], unique=False, postgresql_using="gist")
    op.create_index("idx_faults_status_severity", "faults", ["status", "severity"], unique=False)
    op.create_index(op.f("ix_faults_asset_id"), "faults", ["asset_id"], unique=False)
    op.create_index(op.f("ix_faults_fault_id"), "faults", ["fault_id"], unique=True)


def downgrade() -> None:
    op.drop_table("faults")
    op.drop_table("utility_assets")
    op.drop_table("transformers")
    op.drop_table("feeders")
    op.drop_table("substations")
    op.drop_table("areas")
    op.drop_table("cities")
    op.drop_table("districts")
    op.drop_table("states")
    op.drop_table("countries")
