# GridGuard AI – API & WebSocket Reference (Phases 3–9)

Covers both the **Node Express + WebSocket Operational Server** (`server.ts`, port `3000`) and the **FastAPI + PostgreSQL/PostGIS GIS Backend** (`app/main.py`, port `8000`).

---

## 1. Authentication, Refresh Tokens & RBAC

| Endpoint | Method | Purpose |
| :--- | :---: | :--- |
| `/api/auth/register` | `POST` | Register a utility operator account (salted `scrypt` password hashing). |
| `/api/auth/login` | `POST` | Authenticate credentials and receive HS256 `accessToken` + `refreshToken`. |
| `/api/auth/demo-session` | `POST` | Issue demo session token for an RBAC role (disabled when `ENABLE_DEMONSTRATION_MODE=false`). |
| `/api/auth/refresh` | `POST` | Rotate refresh token (revokes old `jti`) and return fresh access/refresh pair. |
| `/api/auth/logout` | `POST` | Revoke active refresh token so it cannot be replayed. |
| `/api/auth/me` | `GET` | Inspect authenticated Bearer claims (`sub`, `email`, `role`, `expiresAtMs`). |

### 5-Role Separation of Duties Matrix
- **`ADMIN`**: Full operational oversight, approvals, field verification, AI recalculation, user/asset administration, and backup/restore.
- **`GRID_ENGINEER` (`Control Room Engineer`)**: Runs What-If simulations, triggers AI recalculation, and submits proposals (`cannot self-approve`).
- **`REVIEWER_APPROVER` (`Utility Manager`)**: Reviews, approves/rejects proposals, assigns field teams, verifies 5-point closure checklists.
- **`FIELD_ENGINEER`**: Executes assigned tasks, updates field status, uploads validated inspection evidence.
- **`VIEWER`**: Read-only observability across dashboards, maps, alerts, and reports.

---

## 2. Real-Time WebSocket Stream (`/ws/grid`)

Connect via `ws://localhost:3000/ws/grid` (or `wss://<host>/ws/grid` over TLS; FastAPI also exposes `/ws/grid` and `/api/ws/grid`).

### Server-to-Client Envelope
```json
{
  "type": "WELCOME | TELEMETRY_BATCH | ALERT_CREATED | ALERT_ACKNOWLEDGED | INCIDENT_TRIGGERED | AI_UPDATE | GOVERNANCE_UPDATE | FIELD_UPDATE | DIGITAL_TWIN_UPDATE | DEMO_RESET | PONG",
  "timestamp": "2026-11-21T12:00:00.000Z",
  "payload": {}
}
```
Client heartbeat frames: `{ "type": "PING" }` receives `{ "type": "PONG" }`.

---

## 3. Alerts, Demo Simulation & Monitoring

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/health` | `GET` | System readiness: `apiStatus`, `databaseStatus`, `aiServiceStatus`, `websocketStatus`, `activeWsConnections`, `uptimeSeconds`, `errorCount`. |
| `/api/monitoring/metrics` | `GET` | Request totals, rolling p95/avg latency (ms), error rate, failed login counter, AI runs, and structured operational logs. |
| `/api/alerts` | `GET` | Paginated (`limit`, `offset`, `severity`) Alert Center records + `unacknowledgedCount`. |
| `/api/alerts/{id}/acknowledge` | `POST` | Marks an alert acknowledged and broadcasts `ALERT_ACKNOWLEDGED` over `/ws/grid`. |
| `/api/demo/simulate-incident` | `POST` | Generates a live `CRITICAL` fault/alert/notification and animates the asset on Mapbox (requires `ENABLE_DEMONSTRATION_MODE=true`). |
| `/api/demo/reset` | `POST` | Restores baseline Indian utility demo faults, alerts, and notifications and broadcasts `DEMO_RESET`. |

---

## 4. GIS, Search, Governance & AI Intelligence

### Geography & Spatial GIS (FastAPI + PostGIS & Node Proxy)
- `GET /api/geography/{countries,states,districts,cities,areas}`
- `GET /api/assets?bbox=south,west,north,east&limit=200&offset=0` (`Cache-Control: private, max-age=15`)
- `GET /api/map/assets?bbox=south,west,north,east&limit=150&offset=0`
- `GET /api/assets/nearby?latitude=17.4482&longitude=78.3915&radius=2500`
- `GET /api/assets/{asset_id}`
- `GET /api/grid/{substations,feeders,transformers,switches,faults}`
- `GET /api/search?q=Madhapur` & `GET /api/routes?feeder_code=FDR-TG-06U-01`

### Simulation, Governance & AI Intelligence
- `POST /api/simulation/run`, `GET /api/simulation/scenarios`, `GET /api/simulation/results/{id}`
- `GET/POST /api/decisions`, `PUT /api/decisions/{id}`, `POST /api/approvals`
- `GET/POST /api/tasks`, `PUT /api/tasks/{id}`, `POST /api/evidence`, `GET /api/evidence/{taskId}`
- `GET /api/audit?action=&limit=50&offset=0`, `GET /api/notifications`, `POST /api/notifications/{id}/read`
- `GET /api/ai/{health,predictions,risk,recommendations,patterns}`, `POST /api/ai/recalculate`

---

## 5. Phase 9 Enterprise Digital Twin, Executive & Administration APIs

| Endpoint | Method | Auth / Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/digital-twin/network` | `GET` | Standard | Full synchronized Digital Twin node/edge hierarchy (`state` query filter supported). |
| `/api/digital-twin/assets` | `GET` | Standard | Paginated Digital Twin asset representations and 7-stage lifecycle status (`asset_id`, `state`, `limit`, `offset`). |
| `/api/executive/dashboard` | `GET` | Standard | Executive KPI summary: Grid Health %, Network Risk, Active Faults, AI Recommendations, Pending Approvals, Reliability %. |
| `/api/performance` | `GET` | Standard | Regional performance analytics (`MTTR`, `MTBF`, Reliability %, Availability %, Faults/100km, Maintenance Compliance). |
| `/api/analytics` | `GET` | Standard | AI operational insights, failure pattern metrics, model ROC-AUC/drift posture, and risk distributions. |
| `/api/reports` | `GET/POST` | Standard / Operator | List or append executive report generation ledger entries (`GRID_HEALTH`, `REGIONAL_PERFORMANCE`, `ASSET_RELIABILITY`, `DECISION_GOVERNANCE`). |
| `/api/admin/system-health` | `GET` | Standard | Service health posture, active RBAC roles, and enterprise configuration snapshot. |
| `/api/admin/users` | `GET/POST/PATCH` | `ADMIN` | List, provision, or modify utility operator accounts and RBAC roles (`server.ts`). |
| `/api/admin/settings` | `PUT` | `ADMIN` | Update AI model thresholds and alert escalation rules (`server.ts`). |
| `/api/admin/assets/import` | `POST` | `ADMIN` | Bulk-import JSON utility assets into the live Digital Twin and broadcast `DIGITAL_TWIN_UPDATE`. |
| `/api/admin/backups`, `/api/admin/backup`, `/api/admin/restore` | `GET/POST` | `ADMIN` | List, create, and verify/restore SHA-256 encrypted state checkpoints (`server.ts`). |

---

## 6. Phase 11 Live Field Operations & Workforce Tracking APIs

FastAPI mounts these routes under `/api/field/*` (`app/api/routes/field_ops.py`) and the Express operational server mirrors them at `/api/field/*` (`server.ts`).

| Endpoint | Method | Auth / Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/field/engineers` | `GET` | Standard | List all field engineers (`status`, `state` filters supported) with telemetry, skills, and active assignments. |
| `/api/field/live-locations` | `GET` | Standard | Latest GPS breadcrumb coordinates, speed, heading, battery %, and network posture per engineer. |
| `/api/field/location/update` | `POST` | `ADMIN`, `REVIEWER_APPROVER`, `FIELD_ENGINEER` | Validate lat/lon bounds (`-90..90`, `-180..180`), update live position, evaluate circular geofences, and broadcast `ENGINEER_LOCATION_UPDATED` + `GEOFENCE_EVENT`. |
| `/api/field/tasks` | `POST` | `ADMIN`, `REVIEWER_APPROVER` | Dispatch/create a field task linked to an engineer and canonical asset; computes initial route & audit log. |
| `/api/field/tasks/{task_id}` | `PUT` | `ADMIN`, `REVIEWER_APPROVER`, `FIELD_ENGINEER` | Transition task status (`ASSIGNED`, `ACCEPTED`, `TRAVELING`, `ON_SITE`, `INSPECTION`, `REPAIR`, `VERIFICATION`, `PAUSED`, `COMPLETED`, `VERIFIED`) or reassign crew. |
| `/api/field/tasks/{task_id}/accept` | `POST` | `ADMIN`, `REVIEWER_APPROVER`, `FIELD_ENGINEER` | Field engineer accepts work order and prepares navigation route. |
| `/api/field/tasks/{task_id}/complete` | `POST` | `ADMIN`, `REVIEWER_APPROVER`, `FIELD_ENGINEER` | Complete field work, trigger `COMPLETED_WORK` geofence check, restore engineer availability, and write audit entry. |
| `/api/field/evidence` | `POST` | `ADMIN`, `REVIEWER_APPROVER`, `FIELD_ENGINEER` | Submit MIME- & size-validated (`<= 8 MB`) photo/PDF evidence with GPS lock, optional video/voice metadata, and meter readings. |
| `/api/field/routes` | `GET` | Standard | Retrieve active route geometries, remaining distance (km), ETA (min), and completion % (`engineer_id`, `task_id` filters). |
| `/api/field/dashboard` | `GET` | Standard | Manager operational KPIs (`engineersOnline`, `engineersTraveling`, `engineersOnSite`, `openTasks`, `highPriorityIncidents`, `avgResponseTimeMin`, `avgRepairTimeMin`, `activeRoutesCount`). |

### Phase 11 WebSocket Events (`/ws/grid`)
- `ENGINEER_LOCATION_UPDATED`: Live GPS position, speed, route progress, ETA, and engineer status updates.
- `GEOFENCE_EVENT`: Triggered on `ENTER_WORK_ZONE`, `LEAVE_WORK_ZONE`, `REACHED_ASSET`, and `COMPLETED_WORK` perimeter transitions.

