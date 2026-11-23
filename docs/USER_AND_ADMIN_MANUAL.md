# GridGuard AI – User & Administrator Manual

## 1. Platform Navigation (14 Synchronized Modules)
1. **Overview Dashboard**: Real-time KPI strip (`Total Assets`, `Healthy Assets`, `Active Faults`, `Critical Alerts`, `Pending Decisions`, `Active Field Teams`, `Open Incidents`, `Avg Resolution Time`), live telemetry pulse feed, AI Predictive Risk Insights, and operational quick triggers.
2. **Data Integrity**: Inspect GIS/SCADA/OMS/WMS identifier conflicts (`DTR-104` vs `DTR-140`), verify provenance payloads, and apply human-confirmed resolutions.
3. **Event Reconstruction**: Step chronologically through corroborated vs. inferred fault cascades with synchronized Mapbox replay.
4. **Knowledge Graph**: Explore Cytoscape topology (`State -> District -> Substation -> Feeder -> Transformer -> Consumer Cluster`) synced bidirectionally with the map.
5. **Grid Map**: Interactive Mapbox GL JS workspace with 8-level geographic cascading filters, smart spatial search, marker clustering, Overpass OSM live asset queries, animated live fault halos, and asset lifecycle inspection.
6. **What-If Simulator**: Model feeder load-transfer or transformer isolation scenarios before execution. **Advisory only** — never switches physical grid breakers directly.
7. **Decision Governance**: Review formal decision proposals, evidence bundles, cryptographic approval signatures, and incident closure verification.
8. **Field Operations**: Dispatch field crews, log GPS inspection notes, attach validated photo/PDF evidence (`<= 8 MB`), and complete the 5-point restoration checklist.
9. **Audit Logs**: Tamper-evident provenance ledger filterable by actor, action type, or active investigation thread, with one-click CSV/Excel export.
10. **Alert Center**: Triage categorized `CRITICAL`, `HIGH`, `MEDIUM`, and `INFO` alerts, acknowledge alerts across WebSocket sessions, and jump directly to affected assets on the Grid Map or Knowledge Graph.
11. **Reports & Health**: Export 10 operational & enterprise datasets in **PDF**, **Excel (.xlsx)**, or sanitized **CSV**, inspect the Report Generation Ledger (`/api/reports`), review live service health/latency telemetry, and manage Demo Mode streams.
12. **Digital Twin**: Inspect the live hierarchical distribution twin (`India -> State -> District -> Substation -> Feeder -> Transformer / Switch / Power Line -> Consumer Cluster`), expand/collapse hierarchy levels, trace upstream/downstream dependency chains, and audit the **7-stage Asset Lifecycle** (`Installation -> Commissioning -> Routine Inspection -> Maintenance -> Repair -> Upgrade -> Replacement`).
13. **Executive Command**: National → State → District → Area drill-down, Regional Performance KPIs (`Reliability %`, `Availability %`, `Fault Frequency/100km`, `MTTR`, `MTBF`, `Maintenance Compliance`, `Response Time`), AI Operational Insights, Multi-Scenario Comparison Matrix, and customizable/reorderable executive dashboard widgets + KPI targets.
14. **System Admin**: RBAC-protected console (`ADMIN` role required for mutations) for operator/role provisioning, bulk JSON asset import into the live Digital Twin, GIS layer toggles, AI threshold & escalation rules, system/audit logs, and SHA-256 backup & recovery.

---

## 2. Administrator Security & RBAC Operations
- **Operator Session Modal**: Click the user badge in the top navbar to inspect your active JWT claims, token expiry countdown, switch demonstration roles (when `ENABLE_DEMONSTRATION_MODE=true`), register a new operator account, or authenticate with username/password.
- **Separation of Duties**: Control Room Engineers cannot self-approve their own switching recommendations; approvals require a Utility Manager (`REVIEWER_APPROVER`) or `ADMIN`.
- **In-Memory Token Storage**: Access and rotating refresh tokens remain strictly in browser memory and refresh automatically 5 minutes before expiry. Signing out revokes the server-side refresh token immediately.

---

## 3. Exporting Operational & Enterprise Reports
From **11. Reports & Health** (or quick buttons in Overview / Executive Command / Audit Logs):
1. Select dataset scope: **Incidents**, **Assets**, **Maintenance**, **Simulations**, **Audit Logs**, **AI Recommendations**, **Enterprise Grid Health**, **Regional Performance Benchmarks**, **Asset Reliability & Lifecycle**, or **Decision Governance**.
2. Choose **PDF** (formatted summary report), **Excel (.xlsx)** (multi-sheet workbook with metadata + data rows), or **CSV** (RFC 4180 quoted & formula-injection sanitized). Every export is logged in the synchronized `/api/reports` ledger.

---

## 4. Demo Mode & Live Simulation
- The navbar displays **DEMO DATA ACTIVE** whenever demonstration mode is active.
- Click **Simulate Fault** in Overview or Reports & Health to broadcast a synthetic fault over `/ws/grid` — all connected sessions immediately receive a toast notification, updated KPI counts, Alert Center row, updated Digital Twin fault state, and animated Mapbox fault beacon.
- Click **Reset Demo** to restore the baseline Severe Weather Cascade dataset cleanly.

---

## 5. Live Field Operations, Intelligent Dispatch & Geo-Fencing
From **8. Field Operations**:
1. **3-Panel Command Center**:
   - **Left Panel**: Switch between **Crew** (live engineer roster with battery, 5G/4G/Offline status, and ETA), **AI Dispatch** (select any faulted asset to rank nearest qualified engineers with distance, ETA, workload, and skill match), and **Tasks** (lifecycle queue).
   - **Center Panel**: Live Mapbox GL JS map rendering color-coded engineer pins (`AVAILABLE` emerald, `TRAVELING` blue, `WORKING` orange, `ON_BREAK` amber, `OFFLINE` gray), Mapbox Directions navigation routes, circular geofence rings, and the synchronized **10-Stage Incident Timeline** & **Geo-Fence Events Feed**.
   - **Right Panel**: Selected engineer telemetry (`Step GPS`, `Graph Chain` in Knowledge Graph, `Offline` simulation), Task Lifecycle Stepper (`Accept -> Travel -> On Site -> Inspection -> Repair -> Verification -> Complete`), and **Evidence Capture** (photo/PDF upload `<= 8 MB`, optional video/voice clip notes, GPS coordinates, and meter readings).
2. **Mobile Engineer App Mode**: Toggle **Mobile Engineer App** in the top header to preview the compact field crew interface for accepting tasks, stepping GPS navigation, and capturing on-site evidence.

