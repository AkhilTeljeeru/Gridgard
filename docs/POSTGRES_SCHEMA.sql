-- ============================================================================
-- GridGuard AI – Production PostgreSQL Relational Schema
-- Version: 1.0.0 (Phase 1 Foundation)
-- Description: Core tables for users, asset registry, multi-system identifiers,
--              data quality issues, operational events, what-if scenarios,
--              engineering decisions, and immutable audit logs.
-- ============================================================================

-- Ensure UUID and PostGIS extensions are active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Clean drop for idempotency in dev environments
DROP TABLE IF EXISTS geofence_events CASCADE;
DROP TABLE IF EXISTS live_locations CASCADE;
DROP TABLE IF EXISTS engineers CASCADE;
DROP TABLE IF EXISTS executive_reports CASCADE;
DROP TABLE IF EXISTS regional_kpis CASCADE;
DROP TABLE IF EXISTS asset_lifecycle CASCADE;
DROP TABLE IF EXISTS ai_model_runs CASCADE;
DROP TABLE IF EXISTS grid_risk_indices CASCADE;
DROP TABLE IF EXISTS ai_recommendations CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS asset_health CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs_v2 CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS evidence CASCADE;
DROP TABLE IF EXISTS field_tasks CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;
DROP TABLE IF EXISTS decision_approvals CASCADE;
DROP TABLE IF EXISTS decision_comments CASCADE;
DROP TABLE IF EXISTS engineering_decisions CASCADE;
DROP TABLE IF EXISTS simulation_asset_links CASCADE;
DROP TABLE IF EXISTS simulation_assets CASCADE;
DROP TABLE IF EXISTS simulation_results CASCADE;
DROP TABLE IF EXISTS simulations CASCADE;
DROP TABLE IF EXISTS simulation_scenarios CASCADE;
DROP TABLE IF EXISTS event_evidence CASCADE;
DROP TABLE IF EXISTS operational_events CASCADE;
DROP TABLE IF EXISTS data_resolution_records CASCADE;
DROP TABLE IF EXISTS data_quality_issues CASCADE;
DROP TABLE IF EXISTS asset_identifiers CASCADE;
DROP TABLE IF EXISTS asset_relationships CASCADE;
DROP TABLE IF EXISTS infrastructure_assets CASCADE;
DROP TABLE IF EXISTS data_import_jobs CASCADE;
DROP TABLE IF EXISTS data_sources CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS asset_type_enum CASCADE;
DROP TYPE IF EXISTS asset_source_enum CASCADE;
DROP TYPE IF EXISTS conflict_status_enum CASCADE;
DROP TYPE IF EXISTS decision_status_enum CASCADE;
DROP TYPE IF EXISTS severity_enum CASCADE;

-- Core Enumerated Types
CREATE TYPE user_role_enum AS ENUM (
    'ADMIN',
    'GRID_ENGINEER',
    'REVIEWER_APPROVER',
    'FIELD_ENGINEER',
    'VIEWER'
);

CREATE TYPE asset_type_enum AS ENUM (
    'SUBSTATION',
    'FEEDER',
    'CIRCUIT_BREAKER',
    'RECLOSER',
    'SECTIONALIZER',
    'TRANSFORMER',
    'TOWER',
    'POLE',
    'PLANT',
    'GENERATOR',
    'ELECTRICAL_EQUIPMENT',
    'CAPACITOR_BANK',
    'LOAD_POINT'
);

CREATE TYPE asset_source_enum AS ENUM (
    'DEMO',
    'OSM',
    'SIMULATED',
    'UTILITY'
);

CREATE TYPE conflict_status_enum AS ENUM (
    'DETECTED',
    'UNDER_REVIEW',
    'RESOLVED',
    'DISMISSED'
);

CREATE TYPE decision_status_enum AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'PENDING_REVIEW',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'IN_PROGRESS',
    'COMPLETED',
    'IMPLEMENTED',
    'CLOSED'
);

CREATE TYPE severity_enum AS ENUM (
    'INFO',
    'WARNING',
    'CRITICAL'
);

-- ----------------------------------------------------------------------------
-- 1. Identity & Role-Based Access Control
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'GRID_ENGINEER',
    department VARCHAR(100) NOT NULL,
    badge_number VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 2. Data Sources & Import Provenance
-- ----------------------------------------------------------------------------
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name VARCHAR(100) UNIQUE NOT NULL, -- 'GIS_ESRI', 'SCADA_OSI', 'OMS_ORACLE', 'WMS_SAP'
    system_type VARCHAR(50) NOT NULL,        -- 'GEOSPATIAL', 'TELEMETRY', 'OUTAGE', 'WORK_ORDER'
    reliability_weight NUMERIC(3,2) NOT NULL DEFAULT 0.85 CHECK (reliability_weight BETWEEN 0.0 AND 1.0),
    api_endpoint VARCHAR(255),
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE data_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(20) NOT NULL, -- 'CSV', 'JSON', 'XLSX'
    file_size_bytes BIGINT NOT NULL,
    records_processed INT NOT NULL DEFAULT 0,
    conflicts_detected INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    initiated_by UUID NOT NULL REFERENCES users(id),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Infrastructure Assets & Topological Relationships
-- ----------------------------------------------------------------------------
CREATE TABLE infrastructure_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_id VARCHAR(100) UNIQUE NOT NULL, -- Single canonical ID e.g., 'SUB-TG-06U', 'FDR-TG-06U-01', 'DTR-TG-06U-104'
    name VARCHAR(200) NOT NULL,
    asset_type asset_type_enum NOT NULL,
    source asset_source_enum NOT NULL DEFAULT 'DEMO',
    substation_id VARCHAR(100),
    feeder_id VARCHAR(100),
    parent_asset_id UUID REFERENCES infrastructure_assets(id) ON DELETE SET NULL,
    voltage_rating VARCHAR(50),                -- e.g., '132/33 kV', '33/11 kV', '11 kV', '11/0.433 kV'
    nominal_voltage_kv NUMERIC(6,2),
    rated_capacity_kva NUMERIC(8,2),
    peak_load_pct NUMERIC(5,2),
    installation_year INT,
    installation_date DATE,
    last_inspection_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    operator VARCHAR(150),
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    division VARCHAR(100),
    subdivision VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    village VARCHAR(100),
    area VARCHAR(100) NOT NULL,
    pincode VARCHAR(16),
    utility_service_area VARCHAR(100),
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    street_address VARCHAR(255),
    landmarks VARCHAR(255),
    geojson JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_canonical ON infrastructure_assets(canonical_id);
CREATE INDEX idx_assets_source ON infrastructure_assets(source);
CREATE INDEX idx_assets_feeder ON infrastructure_assets(feeder_id);
CREATE INDEX idx_assets_substation ON infrastructure_assets(substation_id);
CREATE INDEX idx_assets_geo_hierarchy ON infrastructure_assets(country, state, district, city, area);
CREATE INDEX idx_assets_pincode ON infrastructure_assets(pincode);
CREATE INDEX idx_assets_geom ON infrastructure_assets USING GIST (geom);

-- Administrative & Utility Service Boundaries (State, District, City, Locality, DISCOM)
CREATE TABLE geographic_boundaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    boundary_code VARCHAR(80) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    boundary_level VARCHAR(30) NOT NULL, -- 'STATE', 'DISTRICT', 'CITY', 'LOCALITY', 'SERVICE_AREA'
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    city VARCHAR(100),
    area VARCHAR(100),
    utility_code VARCHAR(50),
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boundaries_level ON geographic_boundaries(boundary_level, state, district);
CREATE INDEX idx_boundaries_geom ON geographic_boundaries USING GIST (geom);

-- Geospatial Power Lines (Feeders & Interconnects)
CREATE TABLE power_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_id VARCHAR(100) UNIQUE NOT NULL,
    substation_id VARCHAR(100),
    feeder_id VARCHAR(100) NOT NULL,
    line_name VARCHAR(150) NOT NULL,
    voltage_rating VARCHAR(50),
    voltage_kv NUMERIC(6,2),
    status VARCHAR(50) NOT NULL DEFAULT 'ENERGIZED',
    source asset_source_enum NOT NULL DEFAULT 'DEMO',
    geom GEOMETRY(LineString, 4326),
    geojson JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_powerlines_geom ON power_lines USING GIST (geom);

CREATE TABLE asset_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES infrastructure_assets(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    external_identifier VARCHAR(100) NOT NULL,
    raw_attributes JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_source_identifier UNIQUE (source_id, external_identifier)
);

-- ----------------------------------------------------------------------------
-- 4. Data Quality, Anomaly & Reconciliation Records
-- ----------------------------------------------------------------------------
CREATE TABLE data_quality_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_type VARCHAR(80) NOT NULL, -- 'IDENTIFIER_MISMATCH', 'ORPHANED_ASSET', 'TIMESTAMP_INVERSION', 'VOLTAGE_OUT_OF_BOUNDS'
    severity severity_enum NOT NULL DEFAULT 'WARNING',
    canonical_asset_id VARCHAR(100),
    conflicting_source_a VARCHAR(100) NOT NULL,
    conflicting_value_a TEXT NOT NULL,
    conflicting_source_b VARCHAR(100) NOT NULL,
    conflicting_value_b TEXT NOT NULL,
    explanation TEXT NOT NULL,
    status conflict_status_enum NOT NULL DEFAULT 'DETECTED',
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dq_status ON data_quality_issues(status);
CREATE INDEX idx_dq_asset ON data_quality_issues(canonical_asset_id);

-- ----------------------------------------------------------------------------
-- 5. Operational Events & Incident Reconstruction Timelines
-- ----------------------------------------------------------------------------
CREATE TABLE operational_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_timestamp TIMESTAMPTZ NOT NULL,
    source_system VARCHAR(50) NOT NULL,
    asset_canonical_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(80) NOT NULL, -- 'BREAKER_TRIP', 'VOLTAGE_SAG', 'CREW_DISPATCH', 'LINE_CLEARANCE', 'RESTORED'
    summary TEXT NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}',
    is_inferred BOOLEAN NOT NULL DEFAULT FALSE,
    confidence_score NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    has_contradiction BOOLEAN NOT NULL DEFAULT FALSE,
    contradiction_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_timestamp ON operational_events(event_timestamp);
CREATE INDEX idx_events_asset ON operational_events(asset_canonical_id);

-- ----------------------------------------------------------------------------
-- 6. Operational What-If Simulator Scenarios & Results
-- ----------------------------------------------------------------------------
CREATE TABLE simulation_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id),
    source_feeder_id VARCHAR(50) NOT NULL,
    target_feeder_id VARCHAR(50) NOT NULL,
    tie_switch_id VARCHAR(50) NOT NULL,
    sectionalizer_id VARCHAR(50) NOT NULL,
    transferred_load_mva NUMERIC(6,2) NOT NULL,
    is_demonstration_mode BOOLEAN NOT NULL DEFAULT TRUE,
    assumptions_log TEXT NOT NULL,
    target_feeder_capacity_mva NUMERIC(6,2) NOT NULL,
    target_feeder_post_load_mva NUMERIC(6,2) NOT NULL,
    min_bus_voltage_pu NUMERIC(4,3) NOT NULL,
    thermal_violation BOOLEAN NOT NULL DEFAULT FALSE,
    voltage_violation BOOLEAN NOT NULL DEFAULT FALSE,
    opendss_script TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 5 What-If Simulation & Decision Intelligence Tables
CREATE TABLE simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id VARCHAR(100) UNIQUE NOT NULL,
    scenario_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    engineer_id VARCHAR(150) NOT NULL,
    scenario_type VARCHAR(40) NOT NULL CHECK (
        scenario_type IN (
            'FEEDER_TRANSFER',
            'TRANSFORMER_ISOLATION',
            'PLANNED_MAINTENANCE',
            'ALTERNATIVE_SUPPLY',
            'LOAD_REDISTRIBUTION'
        )
    ),
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    substation_id VARCHAR(100),
    source_feeder_id VARCHAR(100) NOT NULL,
    target_feeder_id VARCHAR(100) NOT NULL,
    transformer_id VARCHAR(100),
    tie_switch_id VARCHAR(100) NOT NULL,
    load_transfer_pct NUMERIC(5,2) NOT NULL DEFAULT 65.00,
    transferred_load_mva NUMERIC(6,2) NOT NULL,
    expected_duration_min INT NOT NULL DEFAULT 15,
    time_of_operation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    incident_id VARCHAR(100),
    fault_id VARCHAR(100),
    source asset_source_enum NOT NULL DEFAULT 'SIMULATED',
    advisory_only BOOLEAN NOT NULL DEFAULT TRUE,
    opendss_script TEXT,
    created_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_simulations_type ON simulations(scenario_type);
CREATE INDEX idx_simulations_created ON simulations(created_time);

CREATE TABLE simulation_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id VARCHAR(100) NOT NULL REFERENCES simulations(simulation_id) ON DELETE CASCADE,
    asset_id VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (
        role IN ('SOURCE', 'TARGET', 'AFFECTED', 'SWITCH', 'SUBSTATION', 'ISOLATED')
    ),
    asset_name VARCHAR(200),
    asset_type VARCHAR(60),
    source asset_source_enum NOT NULL DEFAULT 'SIMULATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sim_assets_sim_id ON simulation_assets(simulation_id);
CREATE INDEX idx_sim_assets_asset_id ON simulation_assets(asset_id);

CREATE TABLE simulation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id VARCHAR(100) UNIQUE NOT NULL REFERENCES simulations(simulation_id) ON DELETE CASCADE,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    risk_reasons JSONB NOT NULL DEFAULT '[]',
    consumers_affected INT,
    consumers_affected_before INT,
    consumers_restored INT,
    transformers_affected INT NOT NULL DEFAULT 0,
    feeders_affected INT NOT NULL DEFAULT 1,
    load_distribution JSONB NOT NULL DEFAULT '{}',
    estimated_duration INT NOT NULL,
    min_bus_voltage_pu NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    thermal_violation BOOLEAN NOT NULL DEFAULT FALSE,
    voltage_violation BOOLEAN NOT NULL DEFAULT FALSE,
    recommendation TEXT NOT NULL,
    recommendation_reasons JSONB NOT NULL DEFAULT '[]',
    switching_sequence JSONB NOT NULL DEFAULT '[]',
    map_overlay JSONB NOT NULL DEFAULT '{}',
    advisory_only BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sim_results_risk ON simulation_results(risk_level);

-- ----------------------------------------------------------------------------
-- 7. Engineering Decision Traceability & Governance
-- ----------------------------------------------------------------------------
CREATE TABLE engineering_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_code VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'DEC-2026-F01-002'
    title VARCHAR(255) NOT NULL,
    rationale TEXT NOT NULL,
    risk_assessment TEXT NOT NULL,
    target_asset_id VARCHAR(100) NOT NULL,
    proposed_by UUID NOT NULL REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    status decision_status_enum NOT NULL DEFAULT 'DRAFT',
    evidence_bundle JSONB NOT NULL DEFAULT '{}',
    digital_signature_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_proposer_not_approver CHECK (
        status NOT IN ('APPROVED', 'REJECTED') OR proposed_by <> reviewed_by
    )
);

CREATE INDEX idx_decisions_status ON engineering_decisions(status);

-- Phase 6 Decision Governance, Approvals, Field Operations, Evidence & Notifications
CREATE TABLE decisions (
    id SERIAL PRIMARY KEY,
    decision_id VARCHAR(100) UNIQUE NOT NULL,
    decision_code VARCHAR(60) UNIQUE NOT NULL,
    incident_id VARCHAR(100),
    fault_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    rationale TEXT NOT NULL,
    risk_assessment TEXT NOT NULL,
    recommendation_summary TEXT NOT NULL DEFAULT '',
    target_asset_id VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'HIGH',
    risk_level VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    escalated BOOLEAN NOT NULL DEFAULT FALSE,
    state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
    district VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    area VARCHAR(100) NOT NULL DEFAULT 'HITEC City',
    proposed_by VARCHAR(150) NOT NULL,
    proposed_by_email VARCHAR(255) NOT NULL,
    reviewed_by VARCHAR(150),
    reviewed_by_email VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
    source VARCHAR(20) NOT NULL DEFAULT 'DEMO',
    evidence_bundle JSONB NOT NULL DEFAULT '{}',
    verification_checklist JSONB,
    resolution_summary TEXT,
    digital_signature_hash VARCHAR(128),
    closed_by VARCHAR(150),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gov_decisions_status ON decisions(status);
CREATE INDEX idx_gov_decisions_asset ON decisions(target_asset_id);

CREATE TABLE approvals (
    id SERIAL PRIMARY KEY,
    approval_id VARCHAR(100) UNIQUE NOT NULL,
    decision_id VARCHAR(100) NOT NULL REFERENCES decisions(decision_id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    approver_name VARCHAR(150) NOT NULL,
    approver_email VARCHAR(255) NOT NULL,
    approver_role VARCHAR(50) NOT NULL,
    comments TEXT NOT NULL DEFAULT '',
    signature_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_decision ON approvals(decision_id);

CREATE TABLE field_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(100) UNIQUE NOT NULL,
    task_code VARCHAR(60) UNIQUE NOT NULL,
    decision_id VARCHAR(100) NOT NULL REFERENCES decisions(decision_id) ON DELETE CASCADE,
    incident_id VARCHAR(100),
    fault_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    assigned_engineer VARCHAR(150) NOT NULL,
    assigned_engineer_email VARCHAR(255) NOT NULL,
    assigned_team VARCHAR(150) NOT NULL,
    asset_id VARCHAR(100) NOT NULL,
    fault_location VARCHAR(255) NOT NULL,
    gps_lat NUMERIC(10,7) NOT NULL,
    gps_lon NUMERIC(10,7) NOT NULL,
    safety_notes TEXT NOT NULL DEFAULT '',
    priority VARCHAR(20) NOT NULL DEFAULT 'HIGH',
    status VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',
    scheduled_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    completion_notes TEXT,
    verified_by VARCHAR(150),
    verified_at TIMESTAMPTZ,
    source VARCHAR(20) NOT NULL DEFAULT 'DEMO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_field_tasks_status ON field_tasks(status);
CREATE INDEX idx_field_tasks_asset ON field_tasks(asset_id);

CREATE TABLE evidence (
    id SERIAL PRIMARY KEY,
    evidence_id VARCHAR(100) UNIQUE NOT NULL,
    task_id VARCHAR(100) NOT NULL REFERENCES field_tasks(task_id) ON DELETE CASCADE,
    decision_id VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(80) NOT NULL,
    file_size_bytes INT NOT NULL,
    gps_lat NUMERIC(10,7) NOT NULL,
    gps_lon NUMERIC(10,7) NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    inspection_result VARCHAR(40) NOT NULL DEFAULT 'PASS',
    equipment_condition VARCHAR(40) NOT NULL DEFAULT 'GOOD',
    meter_readings JSONB NOT NULL DEFAULT '{}',
    uploaded_by VARCHAR(150) NOT NULL,
    uploaded_by_email VARCHAR(255) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'DEMO',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_task ON evidence(task_id);

-- ----------------------------------------------------------------------------
-- 8. Immutable System Audit Logs & Operational Notifications
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    actor_email VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- 'USER_LOGIN', 'ASSET_SELECTED', 'DATA_RECONCILED', 'SCENARIO_SIMULATED', 'DECISION_SUBMITTED', 'DECISION_APPROVED', 'DECISION_REJECTED', 'DECISION_CLOSED', 'FIELD_TASK_ASSIGNED', 'FIELD_TASK_UPDATED', 'EVIDENCE_UPLOADED', 'CASE_VERIFIED', 'INCIDENT_CLOSED', 'REPORT_EXPORTED'
    module VARCHAR(80) NOT NULL DEFAULT 'Operations',
    target_entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    related_asset_id VARCHAR(100),
    related_incident_id VARCHAR(100),
    change_summary TEXT NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}',
    previous_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_actor ON audit_logs(actor_email);
CREATE INDEX idx_audit_action ON audit_logs(action_type);

CREATE TABLE audit_logs_v2 (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(100) UNIQUE NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    module VARCHAR(80) NOT NULL DEFAULT 'Operations',
    target_entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    related_asset_id VARCHAR(100),
    related_incident_id VARCHAR(100),
    change_summary TEXT NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}',
    ip_address VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_v2_action ON audit_logs_v2(action_type);
CREATE INDEX idx_audit_v2_created ON audit_logs_v2(created_at);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    notification_id VARCHAR(100) UNIQUE NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    related_asset_id VARCHAR(100),
    related_incident_id VARCHAR(100),
    related_decision_id VARCHAR(100),
    related_task_id VARCHAR(100),
    target_view VARCHAR(40),
    source VARCHAR(20) NOT NULL DEFAULT 'DEMO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_read ON notifications(read);

-- ----------------------------------------------------------------------------
-- 8B. Phase 7 AI Predictive Intelligence & Asset Health Tables
-- ----------------------------------------------------------------------------
CREATE TABLE asset_health (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(100) UNIQUE NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(60) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
    district VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    area VARCHAR(100) NOT NULL DEFAULT 'HITEC City',
    substation_id VARCHAR(100),
    feeder_id VARCHAR(100),
    health_score INT NOT NULL CHECK (health_score BETWEEN 0 AND 100),
    category VARCHAR(20) NOT NULL CHECK (category IN ('HEALTHY', 'WARNING', 'CRITICAL')),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    age_years NUMERIC(5,1) NOT NULL DEFAULT 5.0,
    maintenance_overdue_days INT NOT NULL DEFAULT 0,
    historical_fault_count INT NOT NULL DEFAULT 0,
    downtime_hours_90d NUMERIC(6,1) NOT NULL DEFAULT 0.0,
    voltage_deviation_pct NUMERIC(5,2) NOT NULL DEFAULT 1.20,
    peak_load_pct NUMERIC(5,2) NOT NULL DEFAULT 58.00,
    temperature_trend_c NUMERIC(5,1),
    factors JSONB NOT NULL DEFAULT '[]',
    source VARCHAR(20) NOT NULL DEFAULT 'DEMO',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_health_category ON asset_health(category);
CREATE INDEX idx_asset_health_score ON asset_health(health_score);

CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    prediction_id VARCHAR(100) UNIQUE NOT NULL,
    asset_id VARCHAR(100) NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(60) NOT NULL,
    failure_type VARCHAR(60) NOT NULL,
    probability_pct INT NOT NULL CHECK (probability_pct BETWEEN 0 AND 100),
    confidence_score INT NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    estimated_failure_window VARCHAR(80) NOT NULL,
    predicted_date VARCHAR(20) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    contributing_factors JSONB NOT NULL DEFAULT '[]',
    recommended_action TEXT NOT NULL,
    supporting_evidence JSONB NOT NULL DEFAULT '[]',
    source VARCHAR(20) NOT NULL DEFAULT 'DEMO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_asset ON predictions(asset_id);
CREATE INDEX idx_predictions_risk ON predictions(risk_level);

CREATE TABLE ai_recommendations (
    id SERIAL PRIMARY KEY,
    recommendation_id VARCHAR(100) UNIQUE NOT NULL,
    asset_id VARCHAR(100) NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    health_score INT NOT NULL,
    priority VARCHAR(20) NOT NULL,
    recommendation TEXT NOT NULL,
    reasons JSONB NOT NULL DEFAULT '[]',
    expected_risk_reduction_pct INT NOT NULL,
    confidence_score INT NOT NULL,
    linked_prediction_id VARCHAR(100),
    source VARCHAR(20) NOT NULL DEFAULT 'DEMO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_recs_asset ON ai_recommendations(asset_id);
CREATE INDEX idx_ai_recs_priority ON ai_recommendations(priority);

CREATE TABLE grid_risk_indices (
    id SERIAL PRIMARY KEY,
    risk_id VARCHAR(100) UNIQUE NOT NULL,
    scope_level VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    parent_label VARCHAR(150) NOT NULL DEFAULT '',
    risk_score INT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    active_incidents_count INT NOT NULL DEFAULT 0,
    historical_failures_count INT NOT NULL DEFAULT 0,
    avg_asset_health INT NOT NULL DEFAULT 80,
    avg_load_pct INT NOT NULL DEFAULT 60,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grid_risk_scope ON grid_risk_indices(scope_level);
CREATE INDEX idx_grid_risk_level ON grid_risk_indices(risk_level);

CREATE TABLE ai_model_runs (
    id SERIAL PRIMARY KEY,
    run_id VARCHAR(100) UNIQUE NOT NULL,
    model_version VARCHAR(80) NOT NULL,
    algorithm VARCHAR(150) NOT NULL,
    trigger_source VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    training_samples INT NOT NULL,
    precision_pct DOUBLE PRECISION NOT NULL,
    recall_pct DOUBLE PRECISION NOT NULL,
    f1_score DOUBLE PRECISION NOT NULL,
    roc_auc DOUBLE PRECISION NOT NULL,
    drift_status VARCHAR(30) NOT NULL DEFAULT 'STABLE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_model_runs_created ON ai_model_runs(created_at);

-- ----------------------------------------------------------------------------
-- 8C. Phase 9 Enterprise Digital Twin, Asset Lifecycle, Regional KPIs & Reports
-- ----------------------------------------------------------------------------
CREATE TABLE asset_lifecycle (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(100) UNIQUE NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(60) NOT NULL,
    lifecycle_stage VARCHAR(40) NOT NULL CHECK (
        lifecycle_stage IN (
            'INSTALLATION',
            'COMMISSIONING',
            'ROUTINE_INSPECTION',
            'MAINTENANCE',
            'REPAIR',
            'UPGRADE',
            'REPLACEMENT'
        )
    ),
    installation_date VARCHAR(20),
    commissioning_date VARCHAR(20),
    inspection_history JSONB NOT NULL DEFAULT '[]',
    replacement_date VARCHAR(20),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_lifecycle_stage ON asset_lifecycle(lifecycle_stage);

CREATE TABLE regional_kpis (
    id SERIAL PRIMARY KEY,
    region_id VARCHAR(100) UNIQUE NOT NULL,
    region VARCHAR(150) NOT NULL,
    scope_level VARCHAR(30) NOT NULL CHECK (
        scope_level IN ('NATIONAL', 'STATE', 'DISTRICT', 'AREA', 'SUBSTATION')
    ),
    parent_region VARCHAR(150) NOT NULL DEFAULT 'India',
    mttr NUMERIC(6,2) NOT NULL DEFAULT 2.10,
    mtbf NUMERIC(8,2) NOT NULL DEFAULT 640.00,
    availability NUMERIC(5,2) NOT NULL DEFAULT 99.10,
    reliability NUMERIC(5,2) NOT NULL DEFAULT 98.40,
    fault_frequency NUMERIC(6,2) NOT NULL DEFAULT 1.40,
    maintenance_compliance NUMERIC(5,2) NOT NULL DEFAULT 91.50,
    response_time_min NUMERIC(6,1) NOT NULL DEFAULT 18.0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regional_kpis_scope ON regional_kpis(scope_level);
CREATE INDEX idx_regional_kpis_region ON regional_kpis(region);

CREATE TABLE executive_reports (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(100) UNIQUE NOT NULL,
    generated_by VARCHAR(255) NOT NULL,
    report_type VARCHAR(60) NOT NULL,
    export_format VARCHAR(20) NOT NULL DEFAULT 'PDF',
    scope_label VARCHAR(150) NOT NULL DEFAULT 'All Regions',
    row_count INT NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_executive_reports_type ON executive_reports(report_type);
CREATE INDEX idx_executive_reports_generated_at ON executive_reports(generated_at);

-- ----------------------------------------------------------------------------
-- 8D. Phase 11 Live Field Operations & Real-Time Workforce Tracking
-- ----------------------------------------------------------------------------
ALTER TABLE field_tasks
    ADD COLUMN IF NOT EXISTS engineer_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS eta_minutes INT,
    ADD COLUMN IF NOT EXISTS distance_km NUMERIC(8,2),
    ADD COLUMN IF NOT EXISTS estimated_completion_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS route_progress_pct INT DEFAULT 0;

ALTER TABLE evidence
    ADD COLUMN IF NOT EXISTS file_path VARCHAR(500),
    ADD COLUMN IF NOT EXISTS repair_notes TEXT,
    ADD COLUMN IF NOT EXISTS video_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS voice_note_summary TEXT;

CREATE TABLE engineers (
    id SERIAL PRIMARY KEY,
    engineer_id VARCHAR(100) UNIQUE NOT NULL,
    employee_id VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    team VARCHAR(150) NOT NULL,
    assigned_area VARCHAR(150) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
    district VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    skills JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (
        status IN ('AVAILABLE', 'TRAVELING', 'WORKING', 'ON_BREAK', 'OFFLINE')
    ),
    current_task_id VARCHAR(100),
    current_asset_id VARCHAR(100),
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    geom GEOMETRY(Point, 4326),
    speed_kmh NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    battery_pct INT NOT NULL DEFAULT 100 CHECK (battery_pct BETWEEN 0 AND 100),
    network_status VARCHAR(20) NOT NULL DEFAULT '4G_LTE',
    last_location_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_engineers_status ON engineers(status);
CREATE INDEX idx_engineers_geom ON engineers USING GIST (geom);

CREATE TABLE live_locations (
    id SERIAL PRIMARY KEY,
    location_id VARCHAR(100) UNIQUE NOT NULL,
    engineer_id VARCHAR(100) NOT NULL REFERENCES engineers(engineer_id) ON DELETE CASCADE,
    task_id VARCHAR(100),
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    geom GEOMETRY(Point, 4326),
    speed_kmh NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    heading_deg NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    battery_pct INT NOT NULL DEFAULT 100,
    network_status VARCHAR(20) NOT NULL DEFAULT '4G_LTE',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_live_locations_engineer ON live_locations(engineer_id, recorded_at DESC);
CREATE INDEX idx_live_locations_geom ON live_locations USING GIST (geom);

CREATE TABLE geofence_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    engineer_id VARCHAR(100) NOT NULL REFERENCES engineers(engineer_id) ON DELETE CASCADE,
    task_id VARCHAR(100),
    fence_id VARCHAR(100) NOT NULL,
    fence_name VARCHAR(200) NOT NULL,
    fence_type VARCHAR(40) NOT NULL,
    asset_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(40) NOT NULL CHECK (
        event_type IN ('ENTER_WORK_ZONE', 'LEAVE_WORK_ZONE', 'REACHED_ASSET', 'COMPLETED_WORK')
    ),
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    distance_meters NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    summary TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geofence_events_engineer ON geofence_events(engineer_id, created_at DESC);
CREATE INDEX idx_geofence_events_asset ON geofence_events(asset_id);

-- ----------------------------------------------------------------------------
-- 9. Canonical Seed Data (Explicitly Marked source = 'DEMO')
--    Uses ONE canonical ID per asset across PostgreSQL, Neo4j, Map, and APIs.
-- ----------------------------------------------------------------------------
INSERT INTO infrastructure_assets (
    canonical_id, name, asset_type, source, substation_id, feeder_id,
    voltage_rating, nominal_voltage_kv, rated_capacity_kva, peak_load_pct, status, operator,
    country, state, district, division, subdivision, city, area, pincode, utility_service_area,
    installation_date, last_inspection_date, latitude, longitude, geom
) VALUES
(
    'SUB-TG-06U', 'Madhapur 132/33 kV EHT Substation (DEMO)', 'SUBSTATION', 'DEMO', 'SUB-TG-06U', NULL,
    '132/33 kV', 132.00, 50000.00, 74.00, 'ACTIVE', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Madhapur Subdivision', 'Hyderabad', 'Madhapur', '500081', 'TGSPDCL',
    '2016-05-12', '2026-10-18', 17.4482000, 78.3915000, ST_SetSRID(ST_MakePoint(78.3915000, 17.4482000), 4326)
),
(
    'FDR-TG-06U-01', 'HITEC City Express 11 kV Feeder 01 (DEMO)', 'FEEDER', 'DEMO', 'SUB-TG-06U', 'FDR-TG-06U-01',
    '11 kV', 11.00, 12500.00, 86.00, 'FAULTED', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Madhapur Subdivision', 'Hyderabad', 'HITEC City', '500081', 'TGSPDCL',
    '2018-03-20', '2026-10-14', 17.4454000, 78.3834000, ST_SetSRID(ST_MakePoint(78.3834000, 17.4454000), 4326)
),
(
    'FDR-TG-06U-02', 'Mindspace IT Park 11 kV Feeder 02 (DEMO)', 'FEEDER', 'DEMO', 'SUB-TG-06U', 'FDR-TG-06U-02',
    '11 kV', 11.00, 14000.00, 54.00, 'ACTIVE', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Madhapur Subdivision', 'Hyderabad', 'Mindspace', '500081', 'TGSPDCL',
    '2019-07-11', '2026-10-20', 17.4418000, 78.3858000, ST_SetSRID(ST_MakePoint(78.3858000, 17.4418000), 4326)
),
(
    'CB-TG-06U-01', 'Madhapur Outgoing VCB-01 (DEMO)', 'CIRCUIT_BREAKER', 'DEMO', 'SUB-TG-06U', 'FDR-TG-06U-01',
    '11 kV', 11.00, 12500.00, 0.00, 'FAULTED', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Madhapur Subdivision', 'Hyderabad', 'Madhapur', '500081', 'TGSPDCL',
    '2020-02-14', '2026-10-12', 17.4475000, 78.3895000, ST_SetSRID(ST_MakePoint(78.3895000, 17.4475000), 4326)
),
(
    'SW-TG-06U-14', 'Cyber Gateway RMU Tie Switch-14 (DEMO)', 'SECTIONALIZER', 'DEMO', 'SUB-TG-06U', 'FDR-TG-06U-01',
    '11 kV', 11.00, 12000.00, 12.00, 'ACTIVE', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Madhapur Subdivision', 'Hyderabad', 'HITEC City', '500081', 'TGSPDCL',
    '2021-08-03', '2026-09-29', 17.4412000, 78.3792000, ST_SetSRID(ST_MakePoint(78.3792000, 17.4412000), 4326)
),
(
    'DTR-TG-06U-104', 'Cyber Gateway 630 kVA DTR-104 (DEMO)', 'TRANSFORMER', 'DEMO', 'SUB-TG-06U', 'FDR-TG-06U-01',
    '11/0.433 kV', 11.00, 630.00, 94.00, 'FAULTED', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Madhapur Subdivision', 'Hyderabad', 'HITEC City', '500081', 'TGSPDCL',
    '2021-04-12', '2026-10-08', 17.4435000, 78.3772000, ST_SetSRID(ST_MakePoint(78.3772000, 17.4435000), 4326)
),
(
    'DTR-TG-06U-108', 'Mindspace Bldg-9 500 kVA DTR-108 (DEMO)', 'TRANSFORMER', 'DEMO', 'SUB-TG-06U', 'FDR-TG-06U-02',
    '11/0.433 kV', 11.00, 500.00, 62.00, 'ACTIVE', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Madhapur Subdivision', 'Hyderabad', 'Mindspace', '500081', 'TGSPDCL',
    '2022-01-19', '2026-10-19', 17.4396000, 78.3802000, ST_SetSRID(ST_MakePoint(78.3802000, 17.4396000), 4326)
),
(
    'SUB-TG-07D', 'Gachibowli 33/11 kV Distribution Substation (DEMO)', 'SUBSTATION', 'DEMO', 'SUB-TG-07D', NULL,
    '33/11 kV', 33.00, 25000.00, 68.00, 'ACTIVE', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Gachibowli Subdivision', 'Hyderabad', 'Gachibowli', '500032', 'TGSPDCL',
    '2017-11-05', '2026-10-22', 17.4328000, 78.3562000, ST_SetSRID(ST_MakePoint(78.3562000, 17.4328000), 4326)
),
(
    'FDR-TG-07D-01', 'Financial District 11 kV Feeder 01 (DEMO)', 'FEEDER', 'DEMO', 'SUB-TG-07D', 'FDR-TG-07D-01',
    '11 kV', 11.00, 10000.00, 58.00, 'ACTIVE', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Gachibowli Subdivision', 'Hyderabad', 'Gachibowli', '500032', 'TGSPDCL',
    '2019-06-18', NULL, 17.4282000, 78.3504000, ST_SetSRID(ST_MakePoint(78.3504000, 17.4282000), 4326)
),
(
    'CB-TG-07D-01', 'Gachibowli Feeder-01 VCB (DEMO)', 'CIRCUIT_BREAKER', 'DEMO', 'SUB-TG-07D', 'FDR-TG-07D-01',
    '11 kV', 11.00, 10000.00, 58.00, 'ACTIVE', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Gachibowli Subdivision', 'Hyderabad', 'Gachibowli', '500032', 'TGSPDCL',
    '2019-06-18', '2026-10-15', 17.4316000, 78.3548000, ST_SetSRID(ST_MakePoint(78.3548000, 17.4316000), 4326)
),
(
    'DTR-TG-07D-201', 'Gachibowli Circle 315 kVA DTR-201 (DEMO)', 'TRANSFORMER', 'DEMO', 'SUB-TG-07D', 'FDR-TG-07D-01',
    '11/0.433 kV', 11.00, 315.00, 51.00, 'ACTIVE', 'TGSPDCL (Demo)',
    'India', 'Telangana', 'Hyderabad', 'Cyberabad Circle', 'Gachibowli Subdivision', 'Hyderabad', 'Gachibowli', '500032', 'TGSPDCL',
    NULL, NULL, 17.4264000, 78.3472000, ST_SetSRID(ST_MakePoint(78.3472000, 17.4264000), 4326)
);

