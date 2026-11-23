# GridGuard AI – Unified System Architecture (Phases 1–9)

## 1. Executive Summary
**GridGuard AI** is a unified **Enterprise Digital Twin & Smart Utility Decision-Intelligence Platform** for electricity distribution networks. It reconciles fragmented utility records across GIS, SCADA, OMS, and WMS systems into one synchronized operational workspace governed by human-in-the-loop accountability:

**Observe (GIS + Telemetry) → Digital Twin (Live State + Lifecycle) → Reconstruct (Timeline + Knowledge Graph) → Predict (AI Engine) → Simulate (What-If Advisory) → Executive Command & Govern (Approvals + Field Ops + Audit)**

> **Safety Boundary**: GridGuard AI is a decision-support platform, **not** an automated SCADA breaker control system. No live grid switch or feeder re-energization occurs without explicit human engineering authorization and field verification.

---

## 2. Production Platform Topology

```text
+-------------------------------------------------------------------------------+
|               SMART METER / SCADA / DEMO TELEMETRY / OPENSTREETMAP             |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|        EXPRESS + WEBSOCKET SERVER (server.ts, Port 3000) & FASTAPI GIS         |
|  - /ws/grid Real-Time WebSocket Stream (Telemetry, Faults, Alerts, AI, Twin)   |
|  - JWT Access + Refresh Auth (scrypt hashing, token revocation, 5-Role RBAC)  |
|  - Enterprise APIs (/api/digital-twin/*, /api/executive/*, /api/performance,  |
|    /api/analytics, /api/reports, /api/admin/*)                                |
|  - PostGIS Spatial Engine (app/main.py, Port 8000) & Overpass BBox Cache      |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|            SYNCHRONIZED REACT + MAPBOX GL JS OPERATIONAL WORKSPACE             |
|  1. Overview Dashboard       2. Data Integrity        3. Event Reconstruction  |
|  4. Knowledge Graph          5. Grid Map (Mapbox)     6. What-If Simulator     |
|  7. Decision Governance      8. Field Operations      9. Audit Logs            |
| 10. Centralized Alert Center 11. Reports & Health    12. Digital Twin          |
| 13. Executive Command        14. System Admin                                  |
+-------------------------------------------------------------------------------+
```

---

## 3. Core Capabilities by Phase
1. **Phases 1–3 (GIS & Data Integrity)**: Canonical asset normalization (`SUB-TG-06U`, `FDR-TG-06U-01`, `DTR-TG-06U-104`), OpenStreetMap Overpass bounding-box ingestion with 24h TTL caching, FastAPI + PostGIS (`ST_Within`, `ST_DWithin`, KNN `<->`), and Mapbox GL JS clustering (`clusterMaxZoom=13`).
2. **Phase 4 (Intelligence Layer)**: Bidirectional synchronization across Grid Map, Cytoscape Knowledge Graph, and chronological Event Reconstruction timelines.
3. **Phase 5 (What-If Simulation)**: Baseline vs. proposed feeder transfer and transformer isolation impact analysis, thermal loading margins, risk classification, and advisory recommendations.
4. **Phase 6 (Governance & Field Ops)**: Dual-signature separation of duties (`Control Room Engineer != Utility Manager`), cryptographic decision hashing, GPS-tagged field evidence uploads (`<= 8 MB`, MIME validated), 5-point verification checklist closure, and immutable audit provenance.
5. **Phase 7 (AI Intelligence Engine)**: 0–100 Asset Health Scores, failure probability forecasts, regional/substation Grid Risk Indices, historical pattern clustering, and explainable maintenance recommendations.
6. **Phase 8 (Production & Real-Time Operations)**: Dual WebSocket streaming (`/ws/grid`), Centralized Alert Center, rotating JWT + salted `scrypt` authentication, `/api/health`, `/api/monitoring/metrics`, and multi-format PDF/Excel/CSV reporting.
7. **Phase 9 (Enterprise Readiness, Digital Twin & Innovation Layer)**:
   - **Live Digital Twin Hierarchy**: `India -> State -> District -> Substation -> Feeder -> Transformer / Switch / Power Line -> Consumer Cluster` with expand/collapse navigation and upstream/downstream dependency tracing.
   - **7-Stage Asset Lifecycle Management**: Tracks `Installation -> Commissioning -> Routine Inspection -> Maintenance -> Repair -> Upgrade -> Replacement` inside both Digital Twin and Grid Map asset inspection.
   - **Executive Command Center**: National → State → District → Area drill-down, Regional Performance KPIs (Reliability %, Availability %, Faults/100km, MTTR, MTBF, Maintenance Compliance, Response Time), AI Operational Insights, Multi-Scenario Matrix, and customizable/reorderable executive widgets + SLA targets.
   - **Enterprise System Administration**: RBAC user/role provisioning, bulk JSON asset import, GIS map layer toggles, AI threshold & escalation rules, activity/audit logs, and SHA-256 backup/restore.
   - **Database Persistence (`POSTGRES_SCHEMA.sql` + Alembic `20261121_0005`)**: Adds `asset_lifecycle`, `regional_kpis`, and `executive_reports` tables.
8. **Phase 11 (Live Field Operations & Real-Time Workforce Tracking)**:
   - **Live Workforce GPS Telemetry**: Real-time engineer markers (`AVAILABLE`, `TRAVELING`, `WORKING`, `ON_BREAK`, `OFFLINE`), battery %, network status (`5G`, `4G_LTE`, `OFFLINE`), and active assignments streamed over `/ws/grid` (`ENGINEER_LOCATION_UPDATED`).
   - **Intelligent Dispatch & Route Navigation**: Ranks field engineers by Haversine proximity, driving ETA, skill compatibility, and active workload while keeping final approval/dispatch under human Manager control; renders Mapbox Directions routes with deterministic corridor fallback.
   - **Geo-Fencing & 10-Stage Incident Timeline**: Circular geofences around Substations, Transformers, Maintenance Zones, and Fault Locations emit `ENTER_WORK_ZONE`, `LEAVE_WORK_ZONE`, `REACHED_ASSET`, and `COMPLETED_WORK` (`GEOFENCE_EVENT`) and drive the 10-stage Incident Timeline.
   - **Knowledge Graph Workforce Chain**: Extends Cytoscape topology with `FIELD_ENGINEER -> INCIDENT -> Target Asset -> Feeder -> Substation -> HISTORICAL_INCIDENT` paths.
   - **Database Persistence (`POSTGRES_SCHEMA.sql` + Alembic `20261121_0006`)**: Adds `engineers`, `live_locations`, and `geofence_events` tables plus extended lifecycle columns on `field_tasks` and `evidence`.

