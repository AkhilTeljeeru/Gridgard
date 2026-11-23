from typing import List, Optional
from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    iso_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False, index=True)

    states: Mapped[List["State"]] = relationship(
        back_populates="country",
        cascade="all, delete-orphan",
    )


class State(Base):
    __tablename__ = "states"
    __table_args__ = (
        Index("idx_states_geometry", "geometry", postgresql_using="gist"),
        Index("idx_states_country_name", "country_id", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    country_id: Mapped[int] = mapped_column(
        ForeignKey("countries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    state_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    geometry: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False),
        nullable=True,
    )

    country: Mapped["Country"] = relationship(back_populates="states")
    districts: Mapped[List["District"]] = relationship(
        back_populates="state",
        cascade="all, delete-orphan",
    )


class District(Base):
    __tablename__ = "districts"
    __table_args__ = (
        Index("idx_districts_geometry", "geometry", postgresql_using="gist"),
        Index("idx_districts_state_name", "state_id", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_id: Mapped[int] = mapped_column(
        ForeignKey("states.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    geometry: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False),
        nullable=True,
    )

    state: Mapped["State"] = relationship(back_populates="districts")
    cities: Mapped[List["City"]] = relationship(
        back_populates="district",
        cascade="all, delete-orphan",
    )


class City(Base):
    __tablename__ = "cities"
    __table_args__ = (
        Index("idx_cities_geometry", "geometry", postgresql_using="gist"),
        Index("idx_cities_district_name", "district_id", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    district_id: Mapped[int] = mapped_column(
        ForeignKey("districts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    geometry: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False),
        nullable=True,
    )

    district: Mapped["District"] = relationship(back_populates="cities")
    areas: Mapped[List["Area"]] = relationship(
        back_populates="city",
        cascade="all, delete-orphan",
    )


class Area(Base):
    __tablename__ = "areas"
    __table_args__ = (
        Index("idx_areas_geometry", "geometry", postgresql_using="gist"),
        Index("idx_areas_city_pincode", "city_id", "pincode"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city_id: Mapped[int] = mapped_column(
        ForeignKey("cities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    geometry: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False),
        nullable=True,
    )

    city: Mapped["City"] = relationship(back_populates="areas")
