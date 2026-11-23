// ============================================================================
// GridGuard AI – Neo4j Graph Model & Constraints (Canonical Single Source)
// Version: 2.0.0
// Description: Graph schema representing Indian distribution network topology
//              using ONE canonical ID per asset across Map, Neo4j, PostgreSQL,
//              and API responses, plus explicit source provenance ('DEMO').
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Uniqueness & Node Key Constraints (Unified on n.id === canonicalId)
// ----------------------------------------------------------------------------
CREATE CONSTRAINT uq_substation_id IF NOT EXISTS
FOR (s:Substation) REQUIRE s.id IS UNIQUE;

CREATE CONSTRAINT uq_feeder_id IF NOT EXISTS
FOR (f:Feeder) REQUIRE f.id IS UNIQUE;

CREATE CONSTRAINT uq_breaker_id IF NOT EXISTS
FOR (b:CircuitBreaker) REQUIRE b.id IS UNIQUE;

CREATE CONSTRAINT uq_switch_id IF NOT EXISTS
FOR (sw:Switchgear) REQUIRE sw.id IS UNIQUE;

CREATE CONSTRAINT uq_transformer_id IF NOT EXISTS
FOR (t:Transformer) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT uq_event_id IF NOT EXISTS
FOR (e:OperationalEvent) REQUIRE e.id IS UNIQUE;

CREATE CONSTRAINT uq_decision_id IF NOT EXISTS
FOR (d:EngineeringDecision) REQUIRE d.decision_code IS UNIQUE;

CREATE CONSTRAINT uq_datasource_id IF NOT EXISTS
FOR (ds:DataSource) REQUIRE ds.name IS UNIQUE;

// ----------------------------------------------------------------------------
// 2. Canonical Indian Distribution Seed Graph (source: 'DEMO')
// ----------------------------------------------------------------------------

// Data Sources
MERGE (ds_demo:DataSource {name: 'DEMO_SEED', type: 'DEMONSTRATION', reliability: 1.0})
MERGE (ds_osm:DataSource {name: 'OSM_OVERPASS', type: 'GEOSPATIAL', reliability: 0.90})
MERGE (ds_sim:DataSource {name: 'SIMULATED_SSE', type: 'TELEMETRY', reliability: 0.95})
MERGE (ds_util:DataSource {name: 'UTILITY_SCADA', type: 'SCADA', reliability: 0.99});

// Substations (Realistic Indian 132/33 kV and 33/11 kV ratings)
MERGE (sub_madhapur:Substation {
    id: 'SUB-TG-06U',
    canonicalId: 'SUB-TG-06U',
    name: 'Madhapur 132/33 kV EHT Substation (DEMO)',
    voltage: '132/33 kV',
    primary_voltage_kv: 132.0,
    secondary_voltage_kv: 33.0,
    rated_mva: 50.0,
    operator: 'TGSPDCL (Demo)',
    source: 'DEMO',
    status: 'ACTIVE'
})
MERGE (sub_gachibowli:Substation {
    id: 'SUB-TG-07D',
    canonicalId: 'SUB-TG-07D',
    name: 'Gachibowli 33/11 kV Distribution Substation (DEMO)',
    voltage: '33/11 kV',
    primary_voltage_kv: 33.0,
    secondary_voltage_kv: 11.0,
    rated_mva: 25.0,
    operator: 'TGSPDCL (Demo)',
    source: 'DEMO',
    status: 'ACTIVE'
});

// Feeders
MERGE (fdr_01:Feeder {
    id: 'FDR-TG-06U-01',
    canonicalId: 'FDR-TG-06U-01',
    substationId: 'SUB-TG-06U',
    name: 'HITEC City Express 11 kV Feeder 01 (DEMO)',
    voltage: '11 kV',
    nominal_kv: 11.0,
    rated_capacity_kva: 12500,
    peak_load_pct: 86,
    source: 'DEMO',
    status: 'FAULTED'
})
MERGE (fdr_02:Feeder {
    id: 'FDR-TG-06U-02',
    canonicalId: 'FDR-TG-06U-02',
    substationId: 'SUB-TG-06U',
    name: 'Mindspace IT Park 11 kV Feeder 02 (DEMO)',
    voltage: '11 kV',
    nominal_kv: 11.0,
    rated_capacity_kva: 14000,
    peak_load_pct: 54,
    source: 'DEMO',
    status: 'ACTIVE'
})
MERGE (fdr_07d_01:Feeder {
    id: 'FDR-TG-07D-01',
    canonicalId: 'FDR-TG-07D-01',
    substationId: 'SUB-TG-07D',
    name: 'Financial District 11 kV Feeder 01 (DEMO)',
    voltage: '11 kV',
    nominal_kv: 11.0,
    rated_capacity_kva: 10000,
    peak_load_pct: 58,
    source: 'DEMO',
    status: 'ACTIVE'
});

// Topology Edges: Substation -> Feeder
MERGE (sub_madhapur)-[:FEEDS]->(fdr_01)
MERGE (sub_madhapur)-[:FEEDS]->(fdr_02)
MERGE (sub_gachibowli)-[:FEEDS]->(fdr_07d_01);

// Circuit Breakers & Sectionalizer Tie Switches
MERGE (cb_01:CircuitBreaker {
    id: 'CB-TG-06U-01',
    canonicalId: 'CB-TG-06U-01',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-01',
    name: 'Madhapur Outgoing VCB-01 (DEMO)',
    voltage: '11 kV',
    source: 'DEMO',
    status: 'FAULTED'
})
MERGE (sw_14:Switchgear {
    id: 'SW-TG-06U-14',
    canonicalId: 'SW-TG-06U-14',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-01',
    name: 'Cyber Gateway RMU Tie Switch-14 (DEMO)',
    type: 'SECTIONALIZER',
    voltage: '11 kV',
    source: 'DEMO',
    status: 'ACTIVE'
})
MERGE (cb_07d_01:CircuitBreaker {
    id: 'CB-TG-07D-01',
    canonicalId: 'CB-TG-07D-01',
    substationId: 'SUB-TG-07D',
    feederId: 'FDR-TG-07D-01',
    name: 'Gachibowli Feeder-01 VCB (DEMO)',
    voltage: '11 kV',
    source: 'DEMO',
    status: 'ACTIVE'
});

MERGE (fdr_01)-[:PROTECTED_BY]->(cb_01)
MERGE (fdr_01)-[:CONTAINS_SWITCH]->(sw_14)
MERGE (sw_14)-[:TIE_CONNECTED_TO]->(fdr_02)
MERGE (fdr_07d_01)-[:PROTECTED_BY]->(cb_07d_01);

// Distribution Transformers (11/0.433 kV Indian standard)
MERGE (dtr_104:Transformer {
    id: 'DTR-TG-06U-104',
    canonicalId: 'DTR-TG-06U-104',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-01',
    name: 'Cyber Gateway 630 kVA DTR-104 (DEMO)',
    voltage: '11/0.433 kV',
    rated_kva: 630,
    oms_alias: 'OMS-XFMR-140',
    conflict_flag: true,
    source: 'DEMO',
    status: 'FAULTED'
})
MERGE (dtr_108:Transformer {
    id: 'DTR-TG-06U-108',
    canonicalId: 'DTR-TG-06U-108',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-02',
    name: 'Mindspace Bldg-9 500 kVA DTR-108 (DEMO)',
    voltage: '11/0.433 kV',
    rated_kva: 500,
    conflict_flag: false,
    source: 'DEMO',
    status: 'ACTIVE'
})
MERGE (dtr_201:Transformer {
    id: 'DTR-TG-07D-201',
    canonicalId: 'DTR-TG-07D-201',
    substationId: 'SUB-TG-07D',
    feederId: 'FDR-TG-07D-01',
    name: 'Gachibowli Circle 315 kVA DTR-201 (DEMO)',
    voltage: '11/0.433 kV',
    rated_kva: 315,
    conflict_flag: false,
    source: 'DEMO',
    status: 'ACTIVE'
});

MERGE (fdr_01)-[:FEEDS_TRANSFORMER]->(dtr_104)
MERGE (fdr_02)-[:FEEDS_TRANSFORMER]->(dtr_108)
MERGE (fdr_07d_01)-[:FEEDS_TRANSFORMER]->(dtr_201);

// Operational Incident & Engineering Decision Traceability
MERGE (evt_01:OperationalEvent {
    id: 'EVT-TG-06U-01',
    event_type: 'BREAKER_TRIP_LOCKOUT',
    timestamp: '2026-11-14T03:14:22Z',
    source: 'DEMO',
    summary: 'Demo event: CB-TG-06U-01 tripped on overcurrent protecting FDR-TG-06U-01 from SUB-TG-06U.'
});

MERGE (evt_01)-[:EXPERIENCED_BY]->(fdr_01)
MERGE (evt_01)-[:ISOLATED_BY]->(cb_01);

MERGE (dec_01:EngineeringDecision {
    decision_code: 'DEC-TG-06U-01',
    title: 'Close Tie Switch SW-TG-06U-14 to Restore DTR-TG-06U-104 via FDR-TG-06U-02 (DEMO)',
    status: 'SUBMITTED',
    source: 'DEMO',
    transferred_load_mva: 3.4
});

MERGE (dec_01)-[:TARGETS_ASSET]->(sw_14)
MERGE (dec_01)-[:MITIGATES]->(evt_01);
