# GridGuard AI – Production Deployment & Operations Guide

## 1. Prerequisites
- **Node.js 22+** (runs TypeScript Express + WebSocket server cleanly via `node server.ts` and builds Vite production assets)
- **Python 3.12+** (optional standalone FastAPI + PostGIS GIS engine)
- **PostgreSQL 16 + PostGIS 3.4** & **Neo4j 5.18** (automated via Docker Compose)
- **Mapbox Public Access Token** (`pk.ey...`) for high-resolution Mapbox Dark / Streets / Satellite styles (falls back cleanly to OpenStreetMap raster tiles if absent)

---

## 2. Environment Configuration
Copy `.env.example` to `.env` and populate production secrets:

```bash
cp .env.example .env
```

Critical production variables:
- `NODE_ENV=production`
- `PORT=3000`
- `VITE_MAPBOX_ACCESS_TOKEN="<your-mapbox-public-token>"`
- `JWT_SECRET_KEY="<openssl rand -hex 32>"` *(required strong random key in production)*
- `ENABLE_DEMONSTRATION_MODE="false"` *(set to `"true"` for hackathon/pilot live fault simulations & demo role switcher)*
- `CORS_ORIGINS="https://gridguard.example.com"`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`

---

## 3. Local Development Runbook
```bash
# 1. Install Node packages
npm install

# 2. Start integrated Vite + Express + WebSocket server on port 3000
npm run dev

# 3. Verify TypeScript, build, and automated tests
npm run lint
npm run build
npm test
python3 -m unittest tests/test_gis_backend.py
```

---

## 4. Docker Production Deployment
Start the full production stack (PostGIS + Neo4j + FastAPI GIS Backend + Node.js App Server):

```bash
# Build images and launch detached services
docker compose up -d --build

# Check container health statuses
docker compose ps
```

Exposed service endpoints:
- **GridGuard AI Application & WebSocket Stream**: `http://localhost:3000` (`ws://localhost:3000/ws/grid`)
- **FastAPI OpenAPI GIS Docs**: `http://localhost:8000/docs`
- **PostGIS**: `localhost:5432`
- **Neo4j Browser**: `http://localhost:7474`

---

## 5. Healthcheck & Monitoring Verification
Verify live operational readiness before routing traffic:

```bash
# System health JSON (apiStatus, databaseStatus, aiServiceStatus, websocketStatus, uptimeSeconds)
curl -fsS http://localhost:3000/api/health

# Latency, error count, failed login counter & recent structured server logs
curl -fsS http://localhost:3000/api/monitoring/metrics
```

Expected status: `apiStatus: "HEALTHY"`, HTTP `200 OK`.
