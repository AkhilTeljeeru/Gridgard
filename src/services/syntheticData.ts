import type {
  ActiveFault,
  ApprovalRecord,
  AssetType,
  AuditLog,
  DataQualityIssue,
  EngineeringDecision,
  EventReconstructionIncident,
  EventReconstructionStep,
  FieldEvidence,
  FieldTask,
  GridNotification,
  InfrastructureAsset,
  MaintenanceZone,
  OperationalEvent,
  OsmAsset,
  OsmPowerType,
  PowerLine,
  SimulationScenario,
  SystemStats
} from '../types/grid.ts';
import { executeWhatIfSimulation } from './simulationEngine.ts';

export function formatMissingValue(
  value: string | number | null | undefined,
  suffix = ''
): string {
  if (value === null || value === undefined) return 'Not available';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'Not available';
    return suffix ? `${value}${suffix}` : String(value);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'N/A' || trimmed === 'Unknown' || trimmed === 'Not mapped') {
    return 'Not available';
  }
  return suffix ? `${trimmed}${suffix}` : trimmed;
}

export const INITIAL_ASSETS: InfrastructureAsset[] = [
  // =========================================================================
  // TELANGANA · HYDERABAD (MADHAPUR / HITEC CITY & GACHIBOWLI) — DEMO SEED
  // =========================================================================
  {
    id: 'SUB-TG-06U',
    canonicalId: 'SUB-TG-06U',
    name: 'Madhapur 132/33 kV EHT Substation (DEMO)',
    rawName: 'Madhapur 132/33 kV EHT Substation',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-TG-06U',
    feederId: null,
    voltage: '132/33 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 132,
    ratedCapacityKva: 50000,
    peakLoadPct: 74,
    status: 'ACTIVE',
    latitude: 17.4482,
    longitude: 78.3915,
    geometry: { type: 'Point', coordinates: [78.3915, 17.4482] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Madhapur Subdivision',
    city: 'Hyderabad',
    area: 'Madhapur',
    pincode: '500081',
    utilityServiceArea: 'TGSPDCL',
    streetAddress: 'Plot 14, Madhapur Sub-Station Road, HITEC City',
    landmarks: 'Near Cyber Towers',
    installationDate: '2016-05-12',
    lastInspectionDate: '2026-10-18',
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'SUB-TG-06U' },
      { system: 'NEO4J_GRAPH', aliasId: 'SUB-TG-06U' }
    ]
  },
  {
    id: 'FDR-TG-06U-01',
    canonicalId: 'FDR-TG-06U-01',
    name: 'HITEC City Express 11 kV Feeder 01 (DEMO)',
    rawName: 'HITEC City Express 11 kV Feeder 01',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-01',
    voltage: '11 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 12500,
    peakLoadPct: 86,
    status: 'FAULTED',
    latitude: 17.4454,
    longitude: 78.3834,
    geometry: {
      type: 'LineString',
      coordinates: [
        [78.3915, 17.4482],
        [78.3865, 17.4465],
        [78.3834, 17.4454],
        [78.3782, 17.4435]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Madhapur Subdivision',
    city: 'Hyderabad',
    area: 'HITEC City',
    pincode: '500081',
    utilityServiceArea: 'TGSPDCL',
    streetAddress: 'HITEC City Main Road Corridor',
    installationDate: '2018-03-20',
    lastInspectionDate: '2026-10-14',
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'FDR-TG-06U-01' },
      { system: 'NEO4J_GRAPH', aliasId: 'FDR-TG-06U-01' }
    ]
  },
  {
    id: 'FDR-TG-06U-02',
    canonicalId: 'FDR-TG-06U-02',
    name: 'Mindspace IT Park 11 kV Feeder 02 (DEMO)',
    rawName: 'Mindspace IT Park 11 kV Feeder 02',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-02',
    voltage: '11 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 14000,
    peakLoadPct: 54,
    status: 'ACTIVE',
    latitude: 17.4418,
    longitude: 78.3858,
    geometry: {
      type: 'LineString',
      coordinates: [
        [78.3915, 17.4482],
        [78.3885, 17.4446],
        [78.3858, 17.4418],
        [78.3802, 17.4396]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Madhapur Subdivision',
    city: 'Hyderabad',
    area: 'Mindspace',
    pincode: '500081',
    utilityServiceArea: 'TGSPDCL',
    streetAddress: 'Mindspace Circular Road',
    installationDate: '2019-07-11',
    lastInspectionDate: '2026-10-20',
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'FDR-TG-06U-02' },
      { system: 'NEO4J_GRAPH', aliasId: 'FDR-TG-06U-02' }
    ]
  },
  {
    id: 'CB-TG-06U-01',
    canonicalId: 'CB-TG-06U-01',
    name: 'Madhapur Outgoing VCB-01 (DEMO)',
    rawName: 'Madhapur Outgoing VCB-01',
    osmType: 'switch',
    assetType: 'CIRCUIT_BREAKER',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-01',
    voltage: '11 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 12500,
    peakLoadPct: 0,
    status: 'FAULTED',
    latitude: 17.4475,
    longitude: 78.3895,
    geometry: { type: 'Point', coordinates: [78.3895, 17.4475] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Madhapur Subdivision',
    city: 'Hyderabad',
    area: 'Madhapur',
    pincode: '500081',
    utilityServiceArea: 'TGSPDCL',
    installationDate: '2020-02-14',
    lastInspectionDate: '2026-10-12',
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'CB-TG-06U-01' },
      { system: 'NEO4J_GRAPH', aliasId: 'CB-TG-06U-01' }
    ]
  },
  {
    id: 'SW-TG-06U-14',
    canonicalId: 'SW-TG-06U-14',
    name: 'Cyber Gateway RMU Tie Switch-14 (DEMO)',
    rawName: 'Cyber Gateway RMU Tie Switch-14',
    osmType: 'switch',
    assetType: 'SECTIONALIZER',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-01',
    voltage: '11 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 12000,
    peakLoadPct: 12,
    status: 'ACTIVE',
    latitude: 17.4412,
    longitude: 78.3792,
    geometry: { type: 'Point', coordinates: [78.3792, 17.4412] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Madhapur Subdivision',
    city: 'Hyderabad',
    area: 'HITEC City',
    pincode: '500081',
    utilityServiceArea: 'TGSPDCL',
    installationDate: '2021-08-03',
    lastInspectionDate: '2026-09-29',
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'SW-TG-06U-14' },
      { system: 'NEO4J_GRAPH', aliasId: 'SW-TG-06U-14' }
    ]
  },
  {
    id: 'DTR-TG-06U-104',
    canonicalId: 'DTR-TG-06U-104',
    name: 'Cyber Gateway 630 kVA DTR-104 (DEMO)',
    rawName: 'Cyber Gateway 630 kVA DTR-104',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-01',
    voltage: '11/0.433 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 630,
    peakLoadPct: 94,
    status: 'FAULTED',
    latitude: 17.4435,
    longitude: 78.3772,
    geometry: { type: 'Point', coordinates: [78.3772, 17.4435] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Madhapur Subdivision',
    city: 'Hyderabad',
    area: 'HITEC City',
    pincode: '500081',
    utilityServiceArea: 'TGSPDCL',
    streetAddress: 'Phase 2, HITEC City Cyber Gateway',
    landmarks: 'Opposite Cyber Gateway Plaza',
    installationDate: '2021-04-12',
    lastInspectionDate: '2026-10-08',
    hasConflict: true,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'DTR-TG-06U-104' },
      { system: 'NEO4J_GRAPH', aliasId: 'DTR-TG-06U-104' },
      { system: 'OMS_LEGACY', aliasId: 'OMS-XFMR-140' }
    ]
  },
  {
    id: 'DTR-TG-06U-108',
    canonicalId: 'DTR-TG-06U-108',
    name: 'Mindspace Bldg-9 500 kVA DTR-108 (DEMO)',
    rawName: 'Mindspace Bldg-9 500 kVA DTR-108',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-02',
    voltage: '11/0.433 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 500,
    peakLoadPct: 62,
    status: 'ACTIVE',
    latitude: 17.4396,
    longitude: 78.3802,
    geometry: { type: 'Point', coordinates: [78.3802, 17.4396] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Madhapur Subdivision',
    city: 'Hyderabad',
    area: 'Mindspace',
    pincode: '500081',
    utilityServiceArea: 'TGSPDCL',
    installationDate: '2022-01-19',
    lastInspectionDate: '2026-10-19',
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'DTR-TG-06U-108' },
      { system: 'NEO4J_GRAPH', aliasId: 'DTR-TG-06U-108' }
    ]
  },
  {
    id: 'SUB-TG-07D',
    canonicalId: 'SUB-TG-07D',
    name: 'Gachibowli 33/11 kV Distribution Substation (DEMO)',
    rawName: 'Gachibowli 33/11 kV Distribution Substation',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-TG-07D',
    feederId: null,
    voltage: '33/11 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 33,
    ratedCapacityKva: 25000,
    peakLoadPct: 68,
    status: 'ACTIVE',
    latitude: 17.4328,
    longitude: 78.3562,
    geometry: { type: 'Point', coordinates: [78.3562, 17.4328] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Gachibowli Subdivision',
    city: 'Hyderabad',
    area: 'Gachibowli',
    pincode: '500032',
    utilityServiceArea: 'TGSPDCL',
    installationDate: '2017-11-05',
    lastInspectionDate: '2026-10-22',
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'SUB-TG-07D' },
      { system: 'NEO4J_GRAPH', aliasId: 'SUB-TG-07D' }
    ]
  },
  {
    id: 'FDR-TG-07D-01',
    canonicalId: 'FDR-TG-07D-01',
    name: 'Financial District 11 kV Feeder 01 (DEMO)',
    rawName: 'Financial District 11 kV Feeder 01',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-TG-07D',
    feederId: 'FDR-TG-07D-01',
    voltage: '11 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 10000,
    peakLoadPct: 58,
    status: 'ACTIVE',
    latitude: 17.4282,
    longitude: 78.3504,
    geometry: {
      type: 'LineString',
      coordinates: [
        [78.3562, 17.4328],
        [78.3525, 17.4301],
        [78.3472, 17.4264]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Gachibowli Subdivision',
    city: 'Hyderabad',
    area: 'Gachibowli',
    pincode: '500032',
    utilityServiceArea: 'TGSPDCL',
    installationDate: '2019-06-18',
    lastInspectionDate: null,
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'FDR-TG-07D-01' },
      { system: 'NEO4J_GRAPH', aliasId: 'FDR-TG-07D-01' }
    ]
  },
  {
    id: 'CB-TG-07D-01',
    canonicalId: 'CB-TG-07D-01',
    name: 'Gachibowli Feeder-01 VCB (DEMO)',
    rawName: 'Gachibowli Feeder-01 VCB',
    osmType: 'switch',
    assetType: 'CIRCUIT_BREAKER',
    substationId: 'SUB-TG-07D',
    feederId: 'FDR-TG-07D-01',
    voltage: '11 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 10000,
    peakLoadPct: 58,
    status: 'ACTIVE',
    latitude: 17.4316,
    longitude: 78.3548,
    geometry: { type: 'Point', coordinates: [78.3548, 17.4316] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Gachibowli Subdivision',
    city: 'Hyderabad',
    area: 'Gachibowli',
    pincode: '500032',
    utilityServiceArea: 'TGSPDCL',
    installationDate: '2019-06-18',
    lastInspectionDate: '2026-10-15',
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'CB-TG-07D-01' },
      { system: 'NEO4J_GRAPH', aliasId: 'CB-TG-07D-01' }
    ]
  },
  {
    id: 'DTR-TG-07D-201',
    canonicalId: 'DTR-TG-07D-201',
    name: 'Gachibowli Circle 315 kVA DTR-201 (DEMO)',
    rawName: 'Gachibowli Circle 315 kVA DTR-201',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-TG-07D',
    feederId: 'FDR-TG-07D-01',
    voltage: '11/0.433 kV',
    operator: 'TGSPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 315,
    peakLoadPct: 51,
    status: 'ACTIVE',
    latitude: 17.4264,
    longitude: 78.3472,
    geometry: { type: 'Point', coordinates: [78.3472, 17.4264] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    division: 'Cyberabad Circle',
    subdivision: 'Gachibowli Subdivision',
    city: 'Hyderabad',
    area: 'Gachibowli',
    pincode: '500032',
    utilityServiceArea: 'TGSPDCL',
    installationDate: null,
    lastInspectionDate: null,
    hasConflict: false,
    sourceAliases: [
      { system: 'POSTGRES_REG', aliasId: 'DTR-TG-07D-201' },
      { system: 'NEO4J_GRAPH', aliasId: 'DTR-TG-07D-201' }
    ]
  },

  // =========================================================================
  // KARNATAKA · BENGALURU — DEMO SEED
  // =========================================================================
  {
    id: 'SUB-KA-01U',
    canonicalId: 'SUB-KA-01U',
    name: 'Indiranagar 132/33 kV Receiving Station (DEMO)',
    rawName: 'Indiranagar 132/33 kV Receiving Station',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-KA-01U',
    feederId: null,
    voltage: '132/33 kV',
    operator: 'BESCOM (Demo)',
    nominalVoltageKv: 132,
    ratedCapacityKva: 45000,
    peakLoadPct: 71,
    status: 'ACTIVE',
    latitude: 12.9784,
    longitude: 77.6408,
    geometry: { type: 'Point', coordinates: [77.6408, 12.9784] },
    source: 'DEMO',
    country: 'India',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bengaluru East',
    subdivision: 'Indiranagar',
    city: 'Bengaluru',
    area: 'Indiranagar',
    pincode: '560038',
    utilityServiceArea: 'BESCOM',
    installationDate: '2015-09-24',
    lastInspectionDate: '2026-10-11',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'SUB-KA-01U' }]
  },
  {
    id: 'FDR-KA-01U-01',
    canonicalId: 'FDR-KA-01U-01',
    name: '100ft Road 11 kV Commercial Feeder (DEMO)',
    rawName: '100ft Road 11 kV Commercial Feeder',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-KA-01U',
    feederId: 'FDR-KA-01U-01',
    voltage: '11 kV',
    operator: 'BESCOM (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 11000,
    peakLoadPct: 91,
    status: 'FAULTED',
    latitude: 12.9749,
    longitude: 77.6412,
    geometry: {
      type: 'LineString',
      coordinates: [
        [77.6408, 12.9784],
        [77.6412, 12.9749],
        [77.6416, 12.9712]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bengaluru East',
    subdivision: 'Indiranagar',
    city: 'Bengaluru',
    area: 'Indiranagar',
    pincode: '560038',
    utilityServiceArea: 'BESCOM',
    installationDate: '2018-11-12',
    lastInspectionDate: '2026-10-16',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'FDR-KA-01U-01' }]
  },
  {
    id: 'CB-KA-01U-01',
    canonicalId: 'CB-KA-01U-01',
    name: 'Indiranagar 11 kV Breaker-01 (DEMO)',
    rawName: 'Indiranagar 11 kV Breaker-01',
    osmType: 'switch',
    assetType: 'CIRCUIT_BREAKER',
    substationId: 'SUB-KA-01U',
    feederId: 'FDR-KA-01U-01',
    voltage: '11 kV',
    operator: 'BESCOM (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 11000,
    peakLoadPct: 65,
    status: 'ACTIVE',
    latitude: 12.9772,
    longitude: 77.6410,
    geometry: { type: 'Point', coordinates: [77.641, 12.9772] },
    source: 'DEMO',
    country: 'India',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bengaluru East',
    subdivision: 'Indiranagar',
    city: 'Bengaluru',
    area: 'Indiranagar',
    pincode: '560038',
    utilityServiceArea: 'BESCOM',
    installationDate: '2018-11-12',
    lastInspectionDate: '2026-10-16',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'CB-KA-01U-01' }]
  },
  {
    id: 'DTR-KA-01U-301',
    canonicalId: 'DTR-KA-01U-301',
    name: 'CMH Road 500 kVA DTR-301 (DEMO)',
    rawName: 'CMH Road 500 kVA DTR-301',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-KA-01U',
    feederId: 'FDR-KA-01U-01',
    voltage: '11/0.433 kV',
    operator: 'BESCOM (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 500,
    peakLoadPct: 96,
    status: 'FAULTED',
    latitude: 12.9712,
    longitude: 77.6416,
    geometry: { type: 'Point', coordinates: [77.6416, 12.9712] },
    source: 'DEMO',
    country: 'India',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    division: 'Bengaluru East',
    subdivision: 'Indiranagar',
    city: 'Bengaluru',
    area: 'Indiranagar',
    pincode: '560038',
    utilityServiceArea: 'BESCOM',
    installationDate: '2020-07-30',
    lastInspectionDate: '2026-10-09',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'DTR-KA-01U-301' }]
  },

  // =========================================================================
  // MAHARASHTRA · MUMBAI — DEMO SEED
  // =========================================================================
  {
    id: 'SUB-MH-01U',
    canonicalId: 'SUB-MH-01U',
    name: 'BKC 132/33 kV Receiving Station (DEMO)',
    rawName: 'BKC 132/33 kV Receiving Station',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-MH-01U',
    feederId: null,
    voltage: '132/33 kV',
    operator: 'AEML (Demo)',
    nominalVoltageKv: 132,
    ratedCapacityKva: 60000,
    peakLoadPct: 77,
    status: 'ACTIVE',
    latitude: 19.0662,
    longitude: 72.8674,
    geometry: { type: 'Point', coordinates: [72.8674, 19.0662] },
    source: 'DEMO',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    division: 'Bandra Division',
    subdivision: 'BKC',
    city: 'Mumbai',
    area: 'Bandra Kurla Complex',
    pincode: '400051',
    utilityServiceArea: 'Adani Electricity Mumbai',
    installationDate: '2014-12-01',
    lastInspectionDate: '2026-10-05',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'SUB-MH-01U' }]
  },
  {
    id: 'FDR-MH-01U-01',
    canonicalId: 'FDR-MH-01U-01',
    name: 'BKC G-Block 11 kV Feeder (DEMO)',
    rawName: 'BKC G-Block 11 kV Feeder',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-MH-01U',
    feederId: 'FDR-MH-01U-01',
    voltage: '11 kV',
    operator: 'AEML (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 12000,
    peakLoadPct: 88,
    status: 'WARNING',
    latitude: 19.0631,
    longitude: 72.8648,
    geometry: {
      type: 'LineString',
      coordinates: [
        [72.8674, 19.0662],
        [72.8648, 19.0631],
        [72.8622, 19.0604]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    division: 'Bandra Division',
    subdivision: 'BKC',
    city: 'Mumbai',
    area: 'Bandra Kurla Complex',
    pincode: '400051',
    utilityServiceArea: 'Adani Electricity Mumbai',
    installationDate: '2017-04-21',
    lastInspectionDate: '2026-10-06',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'FDR-MH-01U-01' }]
  },
  {
    id: 'DTR-MH-01U-401',
    canonicalId: 'DTR-MH-01U-401',
    name: 'BKC G-Block 1000 kVA CSS DTR-401 (DEMO)',
    rawName: 'BKC G-Block 1000 kVA CSS DTR-401',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-MH-01U',
    feederId: 'FDR-MH-01U-01',
    voltage: '11/0.433 kV',
    operator: 'AEML (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 1000,
    peakLoadPct: 92,
    status: 'WARNING',
    latitude: 19.0604,
    longitude: 72.8622,
    geometry: { type: 'Point', coordinates: [72.8622, 19.0604] },
    source: 'DEMO',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    division: 'Bandra Division',
    subdivision: 'BKC',
    city: 'Mumbai',
    area: 'Bandra Kurla Complex',
    pincode: '400051',
    utilityServiceArea: 'Adani Electricity Mumbai',
    installationDate: '2021-01-17',
    lastInspectionDate: '2026-10-06',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'DTR-MH-01U-401' }]
  },

  // =========================================================================
  // DELHI & TAMIL NADU — DEMO SEED
  // =========================================================================
  {
    id: 'SUB-DL-01U',
    canonicalId: 'SUB-DL-01U',
    name: 'Okhla Phase-II 33/11 kV Grid Substation (DEMO)',
    rawName: 'Okhla Phase-II 33/11 kV Grid Substation',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-DL-01U',
    feederId: null,
    voltage: '33/11 kV',
    operator: 'BSES Rajdhani (Demo)',
    nominalVoltageKv: 33,
    ratedCapacityKva: 32000,
    peakLoadPct: 66,
    status: 'ACTIVE',
    latitude: 28.5355,
    longitude: 77.2742,
    geometry: { type: 'Point', coordinates: [77.2742, 28.5355] },
    source: 'DEMO',
    country: 'India',
    state: 'Delhi',
    district: 'South East Delhi',
    division: 'Okhla Division',
    subdivision: 'Okhla Phase-II',
    city: 'New Delhi',
    area: 'Okhla Industrial Area',
    pincode: '110020',
    utilityServiceArea: 'BRPL',
    installationDate: '2016-08-14',
    lastInspectionDate: '2026-10-03',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'SUB-DL-01U' }]
  },
  {
    id: 'FDR-DL-01U-01',
    canonicalId: 'FDR-DL-01U-01',
    name: 'Okhla Phase-II 11 kV Industrial Feeder (DEMO)',
    rawName: 'Okhla Phase-II 11 kV Industrial Feeder',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-DL-01U',
    feederId: 'FDR-DL-01U-01',
    voltage: '11 kV',
    operator: 'BSES Rajdhani (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 9500,
    peakLoadPct: 61,
    status: 'ACTIVE',
    latitude: 28.5331,
    longitude: 77.2718,
    geometry: {
      type: 'LineString',
      coordinates: [
        [77.2742, 28.5355],
        [77.2718, 28.5331],
        [77.2695, 28.5305]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Delhi',
    district: 'South East Delhi',
    division: 'Okhla Division',
    subdivision: 'Okhla Phase-II',
    city: 'New Delhi',
    area: 'Okhla Industrial Area',
    pincode: '110020',
    utilityServiceArea: 'BRPL',
    installationDate: '2019-03-09',
    lastInspectionDate: '2026-10-04',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'FDR-DL-01U-01' }]
  },
  {
    id: 'DTR-DL-01U-501',
    canonicalId: 'DTR-DL-01U-501',
    name: 'Okhla Block-C 630 kVA DTR-501 (DEMO)',
    rawName: 'Okhla Block-C 630 kVA DTR-501',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-DL-01U',
    feederId: 'FDR-DL-01U-01',
    voltage: '11/0.433 kV',
    operator: 'BSES Rajdhani (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 630,
    peakLoadPct: 64,
    status: 'ACTIVE',
    latitude: 28.5305,
    longitude: 77.2695,
    geometry: { type: 'Point', coordinates: [77.2695, 28.5305] },
    source: 'DEMO',
    country: 'India',
    state: 'Delhi',
    district: 'South East Delhi',
    division: 'Okhla Division',
    subdivision: 'Okhla Phase-II',
    city: 'New Delhi',
    area: 'Okhla Industrial Area',
    pincode: '110020',
    utilityServiceArea: 'BRPL',
    installationDate: '2021-05-27',
    lastInspectionDate: '2026-10-04',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'DTR-DL-01U-501' }]
  },
  {
    id: 'SUB-TN-01U',
    canonicalId: 'SUB-TN-01U',
    name: 'Taramani 132/33 kV Substation (DEMO)',
    rawName: 'Taramani 132/33 kV Substation',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-TN-01U',
    feederId: null,
    voltage: '132/33 kV',
    operator: 'TANGEDCO (Demo)',
    nominalVoltageKv: 132,
    ratedCapacityKva: 50000,
    peakLoadPct: 63,
    status: 'ACTIVE',
    latitude: 12.9866,
    longitude: 80.2432,
    geometry: { type: 'Point', coordinates: [80.2432, 12.9866] },
    source: 'DEMO',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Chennai',
    division: 'Chennai South',
    subdivision: 'Taramani',
    city: 'Chennai',
    area: 'Taramani OMR',
    pincode: '600113',
    utilityServiceArea: 'TANGEDCO',
    installationDate: '2017-02-19',
    lastInspectionDate: '2026-10-10',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'SUB-TN-01U' }]
  },
  {
    id: 'FDR-TN-01U-01',
    canonicalId: 'FDR-TN-01U-01',
    name: 'Tidel Park 11 kV IT Feeder (DEMO)',
    rawName: 'Tidel Park 11 kV IT Feeder',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-TN-01U',
    feederId: 'FDR-TN-01U-01',
    voltage: '11 kV',
    operator: 'TANGEDCO (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 12000,
    peakLoadPct: 59,
    status: 'ACTIVE',
    latitude: 12.9896,
    longitude: 80.2484,
    geometry: {
      type: 'LineString',
      coordinates: [
        [80.2432, 12.9866],
        [80.2458, 12.9881],
        [80.2484, 12.9896]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Chennai',
    division: 'Chennai South',
    subdivision: 'Taramani',
    city: 'Chennai',
    area: 'Taramani OMR',
    pincode: '600113',
    utilityServiceArea: 'TANGEDCO',
    installationDate: '2019-09-28',
    lastInspectionDate: '2026-10-10',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'FDR-TN-01U-01' }]
  },
  {
    id: 'DTR-TN-01U-601',
    canonicalId: 'DTR-TN-01U-601',
    name: 'Tidel Park 500 kVA DTR-601 (DEMO)',
    rawName: 'Tidel Park 500 kVA DTR-601',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-TN-01U',
    feederId: 'FDR-TN-01U-01',
    voltage: '11/0.433 kV',
    operator: 'TANGEDCO (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 500,
    peakLoadPct: 57,
    status: 'ACTIVE',
    latitude: 12.9896,
    longitude: 80.2484,
    geometry: { type: 'Point', coordinates: [80.2484, 12.9896] },
    source: 'DEMO',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Chennai',
    division: 'Chennai South',
    subdivision: 'Taramani',
    city: 'Chennai',
    area: 'Taramani OMR',
    pincode: '600113',
    utilityServiceArea: 'TANGEDCO',
    installationDate: '2022-03-11',
    lastInspectionDate: '2026-10-10',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'DTR-TN-01U-601' }]
  },
  // =========================================================================
  // TELANGANA REGIONAL DISTRICTS (WARANGAL, KARIMNAGAR, NIZAMABAD) — DEMO SEED
  // =========================================================================
  {
    id: 'SUB-TG-WGL-01',
    canonicalId: 'SUB-TG-WGL-01',
    name: 'Hanamkonda-Warangal 132/33 kV Substation (DEMO)',
    rawName: 'Hanamkonda-Warangal 132/33 kV Substation',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-TG-WGL-01',
    feederId: null,
    voltage: '132/33 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 132,
    ratedCapacityKva: 50000,
    peakLoadPct: 68,
    status: 'ACTIVE',
    latitude: 17.9784,
    longitude: 79.5941,
    geometry: { type: 'Point', coordinates: [79.5941, 17.9784] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Warangal',
    division: 'Warangal Urban Circle',
    subdivision: 'Kazipet Subdivision',
    city: 'Warangal',
    area: 'Kazipet',
    pincode: '506003',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Kazipet Bypass Substation Road, Warangal',
    landmarks: 'Near NIT Warangal Campus',
    installationDate: '2018-06-14',
    lastInspectionDate: '2026-10-08',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'SUB-TG-WGL-01' }]
  },
  {
    id: 'FDR-TG-WGL-01',
    canonicalId: 'FDR-TG-WGL-01',
    name: 'Warangal Fort 11 kV Feeder 01 (DEMO)',
    rawName: 'Warangal Fort 11 kV Feeder 01',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-TG-WGL-01',
    feederId: 'FDR-TG-WGL-01',
    voltage: '11 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 12000,
    peakLoadPct: 61,
    status: 'ACTIVE',
    latitude: 17.9689,
    longitude: 79.6012,
    geometry: {
      type: 'LineString',
      coordinates: [
        [79.5941, 17.9784],
        [79.5978, 17.9735],
        [79.6012, 17.9689]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Warangal',
    division: 'Warangal Urban Circle',
    subdivision: 'Kazipet Subdivision',
    city: 'Warangal',
    area: 'Subedari',
    pincode: '506001',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Subedari Main Corridor, Warangal',
    installationDate: '2019-11-05',
    lastInspectionDate: '2026-10-08',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'FDR-TG-WGL-01' }]
  },
  {
    id: 'DTR-TG-WGL-101',
    canonicalId: 'DTR-TG-WGL-101',
    name: 'Subedari 630 kVA DTR-101 (DEMO)',
    rawName: 'Subedari 630 kVA DTR-101',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-TG-WGL-01',
    feederId: 'FDR-TG-WGL-01',
    voltage: '11/0.433 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 630,
    peakLoadPct: 64,
    status: 'ACTIVE',
    latitude: 17.9845,
    longitude: 79.5664,
    geometry: { type: 'Point', coordinates: [79.5664, 17.9845] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Warangal',
    division: 'Warangal Urban Circle',
    subdivision: 'Kazipet Subdivision',
    city: 'Warangal',
    area: 'Subedari',
    pincode: '506001',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Collectorate Road, Subedari, Warangal',
    installationDate: '2021-03-19',
    lastInspectionDate: '2026-10-08',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'DTR-TG-WGL-101' }]
  },
  {
    id: 'SUB-TG-KRM-01',
    canonicalId: 'SUB-TG-KRM-01',
    name: 'Karimnagar Town 132/33 kV Substation (DEMO)',
    rawName: 'Karimnagar Town 132/33 kV Substation',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-TG-KRM-01',
    feederId: null,
    voltage: '132/33 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 132,
    ratedCapacityKva: 45000,
    peakLoadPct: 65,
    status: 'ACTIVE',
    latitude: 18.4386,
    longitude: 79.1288,
    geometry: { type: 'Point', coordinates: [79.1288, 18.4386] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Karimnagar',
    division: 'Karimnagar Town Circle',
    subdivision: 'Mankammathota Subdivision',
    city: 'Karimnagar',
    area: 'Mankammathota',
    pincode: '505001',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Mankammathota Substation Lane, Karimnagar',
    landmarks: 'Near Karimnagar Collectorate',
    installationDate: '2017-09-22',
    lastInspectionDate: '2026-10-11',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'SUB-TG-KRM-01' }]
  },
  {
    id: 'FDR-TG-KRM-01',
    canonicalId: 'FDR-TG-KRM-01',
    name: 'Karimnagar Central 11 kV Feeder 01 (DEMO)',
    rawName: 'Karimnagar Central 11 kV Feeder 01',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-TG-KRM-01',
    feederId: 'FDR-TG-KRM-01',
    voltage: '11 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 11000,
    peakLoadPct: 58,
    status: 'ACTIVE',
    latitude: 18.4322,
    longitude: 79.1365,
    geometry: {
      type: 'LineString',
      coordinates: [
        [79.1288, 18.4386],
        [79.1324, 18.4352],
        [79.1365, 18.4322]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Karimnagar',
    division: 'Karimnagar Town Circle',
    subdivision: 'Mankammathota Subdivision',
    city: 'Karimnagar',
    area: 'Kothirampur',
    pincode: '505001',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Kothirampur Main Road, Karimnagar',
    installationDate: '2020-01-16',
    lastInspectionDate: '2026-10-11',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'FDR-TG-KRM-01' }]
  },
  {
    id: 'DTR-TG-KRM-101',
    canonicalId: 'DTR-TG-KRM-101',
    name: 'Mankammathota 500 kVA DTR-101 (DEMO)',
    rawName: 'Mankammathota 500 kVA DTR-101',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-TG-KRM-01',
    feederId: 'FDR-TG-KRM-01',
    voltage: '11/0.433 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 500,
    peakLoadPct: 56,
    status: 'ACTIVE',
    latitude: 18.4348,
    longitude: 79.1319,
    geometry: { type: 'Point', coordinates: [79.1319, 18.4348] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Karimnagar',
    division: 'Karimnagar Town Circle',
    subdivision: 'Mankammathota Subdivision',
    city: 'Karimnagar',
    area: 'Mankammathota',
    pincode: '505001',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Clock Tower Circle, Karimnagar',
    installationDate: '2022-04-09',
    lastInspectionDate: '2026-10-11',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'DTR-TG-KRM-101' }]
  },
  {
    id: 'SUB-TG-NZB-01',
    canonicalId: 'SUB-TG-NZB-01',
    name: 'Nizamabad Subhash Nagar 132/33 kV Substation (DEMO)',
    rawName: 'Nizamabad Subhash Nagar 132/33 kV Substation',
    osmType: 'substation',
    assetType: 'SUBSTATION',
    substationId: 'SUB-TG-NZB-01',
    feederId: null,
    voltage: '132/33 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 132,
    ratedCapacityKva: 40000,
    peakLoadPct: 62,
    status: 'ACTIVE',
    latitude: 18.6725,
    longitude: 78.0941,
    geometry: { type: 'Point', coordinates: [78.0941, 18.6725] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Nizamabad',
    division: 'Nizamabad Circle',
    subdivision: 'Subhash Nagar Subdivision',
    city: 'Nizamabad',
    area: 'Subhash Nagar',
    pincode: '503002',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Dichpally Road, Subhash Nagar, Nizamabad',
    landmarks: 'Near Nizamabad Railway Junction',
    installationDate: '2018-11-30',
    lastInspectionDate: '2026-10-05',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'SUB-TG-NZB-01' }]
  },
  {
    id: 'FDR-TG-NZB-01',
    canonicalId: 'FDR-TG-NZB-01',
    name: 'Khaleelwadi 11 kV Urban Feeder 01 (DEMO)',
    rawName: 'Khaleelwadi 11 kV Urban Feeder 01',
    osmType: 'line',
    assetType: 'FEEDER',
    substationId: 'SUB-TG-NZB-01',
    feederId: 'FDR-TG-NZB-01',
    voltage: '11 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 10000,
    peakLoadPct: 54,
    status: 'ACTIVE',
    latitude: 18.6682,
    longitude: 78.0998,
    geometry: {
      type: 'LineString',
      coordinates: [
        [78.0941, 18.6725],
        [78.0970, 18.6703],
        [78.0998, 18.6682]
      ]
    },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Nizamabad',
    division: 'Nizamabad Circle',
    subdivision: 'Subhash Nagar Subdivision',
    city: 'Nizamabad',
    area: 'Khaleelwadi',
    pincode: '503001',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Khaleelwadi Main Road, Nizamabad',
    installationDate: '2020-08-14',
    lastInspectionDate: '2026-10-05',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'FDR-TG-NZB-01' }]
  },
  {
    id: 'DTR-TG-NZB-101',
    canonicalId: 'DTR-TG-NZB-101',
    name: 'Khaleelwadi 500 kVA DTR-101 (DEMO)',
    rawName: 'Khaleelwadi 500 kVA DTR-101',
    osmType: 'transformer',
    assetType: 'TRANSFORMER',
    substationId: 'SUB-TG-NZB-01',
    feederId: 'FDR-TG-NZB-01',
    voltage: '11/0.433 kV',
    operator: 'TGNPDCL (Demo)',
    nominalVoltageKv: 11,
    ratedCapacityKva: 500,
    peakLoadPct: 52,
    status: 'ACTIVE',
    latitude: 18.6704,
    longitude: 78.0972,
    geometry: { type: 'Point', coordinates: [78.0972, 18.6704] },
    source: 'DEMO',
    country: 'India',
    state: 'Telangana',
    district: 'Nizamabad',
    division: 'Nizamabad Circle',
    subdivision: 'Subhash Nagar Subdivision',
    city: 'Nizamabad',
    area: 'Khaleelwadi',
    pincode: '503001',
    utilityServiceArea: 'TGNPDCL',
    streetAddress: 'Khaleelwadi Commercial Complex, Nizamabad',
    installationDate: '2021-10-18',
    lastInspectionDate: '2026-10-05',
    hasConflict: false,
    sourceAliases: [{ system: 'POSTGRES_REG', aliasId: 'DTR-TG-NZB-101' }]
  }
];

export const INITIAL_POWER_LINES: PowerLine[] = INITIAL_ASSETS.filter(
  (a) => a.assetType === 'FEEDER' && a.geometry.type === 'LineString'
).map((feeder) => ({
  id: feeder.canonicalId,
  canonicalId: feeder.canonicalId,
  name: feeder.name,
  rawName: feeder.rawName,
  osmType: feeder.osmType,
  substationId: feeder.substationId,
  feederId: feeder.canonicalId,
  voltage: feeder.voltage,
  operator: feeder.operator,
  voltageKv: feeder.nominalVoltageKv,
  status:
    feeder.status === 'FAULTED'
      ? 'FAULTED'
      : feeder.status === 'WARNING'
        ? 'WARNING'
        : 'ENERGIZED',
  path: feeder.geometry.type === 'LineString'
    ? feeder.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])
    : [],
  source: 'DEMO'
}));

export const INITIAL_FAULTS: ActiveFault[] = [
  {
    id: 'FLT-TG-06U-01',
    faultCode: 'FLT-TG-06U-01',
    title: 'Phase-A Ground Lockout on Cyber Gateway DTR-104 (DEMO)',
    latitude: 17.4435,
    longitude: 78.3772,
    faultRadiusMeters: 280,
    severity: 'CRITICAL',
    status: 'ACTIVE_LOCKOUT',
    affectedAssetId: 'DTR-TG-06U-104',
    affectedAssetName: 'Cyber Gateway 630 kVA DTR-104 (DEMO)',
    affectedSubstationId: 'SUB-TG-06U',
    affectedFeederId: 'FDR-TG-06U-01',
    affectedTransformerId: 'DTR-TG-06U-104',
    affectedTransformerIds: ['DTR-TG-06U-104'],
    detectedAt: '2026-11-14T03:14:22Z',
    lastUpdated: '2026-11-14T03:15:05Z',
    source: 'DEMO',
    telemetrySource: 'DEMO',
    customersInterrupted: 640,
    relatedEventId: 'EVT-TG-06U-01',
    description:
      'Demo fault cascade: Monsoon lightning surge tripped CB-TG-06U-01 downstream of SUB-TG-06U, locking out FDR-TG-06U-01 and de-energizing DTR-TG-06U-104.'
  },
  {
    id: 'FLT-KA-01U-01',
    faultCode: 'FLT-KA-01U-01',
    title: '11 kV Underground Cable Splice Fault on 100ft Road Feeder (DEMO)',
    latitude: 12.9712,
    longitude: 77.6416,
    faultRadiusMeters: 250,
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    affectedAssetId: 'DTR-KA-01U-301',
    affectedAssetName: 'CMH Road 500 kVA DTR-301 (DEMO)',
    affectedSubstationId: 'SUB-KA-01U',
    affectedFeederId: 'FDR-KA-01U-01',
    affectedTransformerId: 'DTR-KA-01U-301',
    affectedTransformerIds: ['DTR-KA-01U-301'],
    detectedAt: '2026-11-14T04:02:11Z',
    lastUpdated: '2026-11-14T04:04:00Z',
    source: 'DEMO',
    telemetrySource: 'DEMO',
    customersInterrupted: 410,
    relatedEventId: 'EVT-KA-01U-01',
    description:
      'Demo fault cascade: Earth-fault protection operated on CB-KA-01U-01 isolating FDR-KA-01U-01 and CMH Road DTR-KA-01U-301.'
  },
  {
    id: 'FLT-MH-01U-01',
    faultCode: 'FLT-MH-01U-01',
    title: 'Thermal Overload & Ground Fault on BKC G-Block Feeder (DEMO)',
    latitude: 19.0604,
    longitude: 72.8622,
    faultRadiusMeters: 220,
    severity: 'WARNING',
    status: 'LINE_GROUNDED',
    affectedAssetId: 'DTR-MH-01U-401',
    affectedAssetName: 'BKC G-Block 1000 kVA CSS DTR-401 (DEMO)',
    affectedSubstationId: 'SUB-MH-01U',
    affectedFeederId: 'FDR-MH-01U-01',
    affectedTransformerId: 'DTR-MH-01U-401',
    affectedTransformerIds: ['DTR-MH-01U-401'],
    detectedAt: '2026-11-14T04:18:05Z',
    lastUpdated: '2026-11-14T04:19:15Z',
    source: 'DEMO',
    telemetrySource: 'DEMO',
    customersInterrupted: null,
    relatedEventId: 'EVT-MH-01U-01',
    description:
      'Demo fault cascade: Ground-fault current excursion on FDR-MH-01U-01 isolated BKC G-Block CSS DTR-MH-01U-401; AMI consumer count telemetry pending.'
  }
];

export const INITIAL_MAINTENANCE_ZONES: MaintenanceZone[] = [
  {
    id: 'MNT-TG-06U-01',
    zoneName: 'Madhapur RMU Preventive Maintenance (DEMO)',
    feederId: 'FDR-TG-06U-02',
    coordinates: [
      [17.4425, 78.3822],
      [17.4425, 78.3878],
      [17.4388, 78.3878],
      [17.4388, 78.3822]
    ],
    scheduledStart: '2026-11-14T09:00:00Z',
    scheduledEnd: '2026-11-14T13:00:00Z',
    workOrderNumber: 'WO-DEMO-2026-041',
    crewLead: 'R. Verma (Demo Crew)',
    status: 'SCHEDULED',
    purpose: 'Demo planned thermography inspection on Mindspace 11 kV RMU bay.',
    source: 'DEMO'
  }
];

export const INITIAL_DATA_QUALITY_ISSUES: DataQualityIssue[] = [
  {
    id: 'DQI-TG-06U-104',
    issueType: 'IDENTIFIER_MISMATCH',
    severity: 'CRITICAL',
    canonicalAssetId: 'DTR-TG-06U-104',
    assetName: 'Cyber Gateway 630 kVA DTR-104 (DEMO)',
    conflictingSourceA: 'POSTGRES / NEO4J CANONICAL',
    conflictingValueA: 'DTR-TG-06U-104',
    conflictingSourceB: 'LEGACY OMS DISPATCH',
    conflictingValueB: 'OMS-XFMR-140',
    explanation:
      'Demo conflict: Legacy OMS dispatch references OMS-XFMR-140 while the canonical registry, map, and Neo4j graph use DTR-TG-06U-104.',
    status: 'DETECTED',
    detectedAt: '2026-11-14T03:10:00Z',
    source: 'DEMO'
  }
];

export const INITIAL_OPERATIONAL_EVENTS: OperationalEvent[] = [
  {
    id: 'EVT-TG-06U-01',
    timestamp: '2026-11-14T03:14:22Z',
    sourceSystem: 'SCADA_OSI',
    source: 'DEMO',
    telemetrySource: 'DEMO',
    assetCanonicalId: 'CB-TG-06U-01',
    assetName: 'Madhapur Outgoing VCB-01 (DEMO)',
    eventType: 'BREAKER_TRIP_LOCKOUT',
    summary:
      'Demo event: CB-TG-06U-01 tripped on overcurrent protecting FDR-TG-06U-01 from SUB-TG-06U.',
    isInferred: false,
    confidenceScore: 1,
    hasContradiction: false
  },
  {
    id: 'EVT-TG-06U-02',
    timestamp: '2026-11-14T03:15:05Z',
    sourceSystem: 'OMS_ORACLE',
    source: 'DEMO',
    telemetrySource: 'DEMO',
    assetCanonicalId: 'DTR-TG-06U-104',
    assetName: 'Cyber Gateway 630 kVA DTR-104 (DEMO)',
    eventType: 'DTR_OUTAGE_REPORTED',
    summary:
      'Demo outage ticket linked to canonical transformer DTR-TG-06U-104 on feeder FDR-TG-06U-01.',
    isInferred: true,
    confidenceScore: 0.94,
    hasContradiction: false
  },
  {
    id: 'EVT-KA-01U-01',
    timestamp: '2026-11-14T04:02:45Z',
    sourceSystem: 'SCADA_OSI',
    source: 'DEMO',
    telemetrySource: 'DEMO',
    assetCanonicalId: 'CB-KA-01U-01',
    assetName: 'Indiranagar 11 kV Breaker-01 (DEMO)',
    eventType: 'EARTH_FAULT_TRIP',
    summary:
      'Demo event: Earth-fault relay operated on CB-KA-01U-01, locking out FDR-KA-01U-01 and CMH Road DTR-KA-01U-301.',
    isInferred: false,
    confidenceScore: 1,
    hasContradiction: false
  },
  {
    id: 'EVT-MH-01U-01',
    timestamp: '2026-11-14T04:18:30Z',
    sourceSystem: 'SCADA_OSI',
    source: 'DEMO',
    telemetrySource: 'DEMO',
    assetCanonicalId: 'FDR-MH-01U-01',
    assetName: 'BKC G-Block 11 kV Feeder (DEMO)',
    eventType: 'LINE_GROUND_FAULT',
    summary:
      'Demo event: Ground fault current spike detected on FDR-MH-01U-01 isolating BKC G-Block CSS DTR-MH-01U-401.',
    isInferred: false,
    confidenceScore: 0.96,
    hasContradiction: true,
    contradictionDetail:
      'AMI head-end consumer counter has not yet synchronized with SCADA relay trip timestamp.'
  }
];

/**
 * Computes a convex hull around given [lat, lng] coordinates and expands it outward
 * by padding degrees so the resulting polygon visually encloses the affected corridor.
 */
export function buildBufferedAffectedPolygon(
  points: Array<[number, number]>,
  padLat = 0.0018,
  padLon = 0.0022
): [number, number][] {
  if (points.length === 0) return [];

  // Deduplicate nearby points
  const unique = points.filter(
    (pt, idx) =>
      points.findIndex(
        (other) => Math.abs(other[0] - pt[0]) < 1e-6 && Math.abs(other[1] - pt[1]) < 1e-6
      ) === idx
  );

  // Expand each affected point by an 8-point buffer ring so linear feeders form a smooth buffered corridor hull
  const diagLat = padLat * 0.7071;
  const diagLon = padLon * 0.7071;
  const buffered: Array<[number, number]> = [];
  for (const [lat, lon] of unique) {
    buffered.push(
      [lat + padLat, lon],
      [lat + diagLat, lon + diagLon],
      [lat, lon + padLon],
      [lat - diagLat, lon + diagLon],
      [lat - padLat, lon],
      [lat - diagLat, lon - diagLon],
      [lat, lon - padLon],
      [lat + diagLat, lon - diagLon]
    );
  }

  // Andrew's monotone chain convex hull in (lng, lat) space
  const sorted = [...buffered].sort((a, b) => (a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]));
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);

  const lower: Array<[number, number]> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];

  return hull.map(([lat, lon]) => [Number(lat.toFixed(6)), Number(lon.toFixed(6))]);
}

export const INITIAL_EVENT_RECONSTRUCTIONS: EventReconstructionIncident[] = [
  {
    id: 'EVT-TG-06U-01',
    faultId: 'FLT-TG-06U-01',
    faultCode: 'FLT-TG-06U-01',
    title: 'Phase-A Ground Lockout on Cyber Gateway DTR-104 (DEMO)',
    description:
      'Monsoon lightning transient on SUB-TG-06U caused CB-TG-06U-01 to trip, locking out FDR-TG-06U-01 and de-energizing Cyber Gateway DTR-TG-06U-104.',
    severity: 'CRITICAL',
    status: 'ACTIVE_LOCKOUT',
    source: 'DEMO',
    detectedAt: '2026-11-14T03:14:22Z',
    substationId: 'SUB-TG-06U',
    feederId: 'FDR-TG-06U-01',
    affectedTransformerIds: ['DTR-TG-06U-104'],
    affectedAssetIds: ['SUB-TG-06U', 'CB-TG-06U-01', 'FDR-TG-06U-01', 'DTR-TG-06U-104', 'SW-TG-06U-14'],
    affectedConsumersCount: 640,
    affectedAreaPolygon: buildBufferedAffectedPolygon([
      [17.4482, 78.3915],
      [17.4475, 78.3895],
      [17.4454, 78.3834],
      [17.4435, 78.3772],
      [17.4412, 78.3792]
    ]),
    steps: [
      {
        stepId: 'STEP-TG-01',
        stepNumber: 1,
        phase: 'TRIGGER',
        title: 'Lightning Strike Surge Detected',
        assetId: 'SUB-TG-06U',
        assetName: 'Madhapur 132/33 kV EHT Substation (DEMO)',
        timestamp: '2026-11-14T03:14:10Z',
        sourceSystem: 'WEATHER_RADAR',
        source: 'DEMO',
        summary: 'Cloud-to-ground lightning strike recorded within 350m of SUB-TG-06U 33/11 kV busbar.',
        targetStatus: 'WARNING',
        latitude: 17.4482,
        longitude: 78.3915
      },
      {
        stepId: 'STEP-TG-02',
        stepNumber: 2,
        phase: 'PROTECTION_TRIP',
        title: 'Breaker Trip (50/51 Overcurrent)',
        assetId: 'CB-TG-06U-01',
        assetName: 'Madhapur Outgoing VCB-01 (DEMO)',
        timestamp: '2026-11-14T03:14:22Z',
        sourceSystem: 'SCADA_OSI',
        source: 'DEMO',
        summary: 'CB-TG-06U-01 tripped at 4.8 kA fault current protecting outgoing 11 kV bay.',
        targetStatus: 'FAULTED',
        latitude: 17.4475,
        longitude: 78.3895
      },
      {
        stepId: 'STEP-TG-03',
        stepNumber: 3,
        phase: 'FEEDER_LOCKOUT',
        title: 'Feeder Lockout (Auto-Reclose Failed)',
        assetId: 'FDR-TG-06U-01',
        assetName: 'HITEC City Express 11 kV Feeder 01 (DEMO)',
        timestamp: '2026-11-14T03:14:28Z',
        sourceSystem: 'SCADA_OSI',
        source: 'DEMO',
        summary: 'Permanent Phase-A to ground fault detected along FDR-TG-06U-01 overhead span.',
        targetStatus: 'FAULTED',
        latitude: 17.4454,
        longitude: 78.3834
      },
      {
        stepId: 'STEP-TG-04',
        stepNumber: 4,
        phase: 'TRANSFORMER_OUTAGE',
        title: 'Transformer De-Energized',
        assetId: 'DTR-TG-06U-104',
        assetName: 'Cyber Gateway 630 kVA DTR-104 (DEMO)',
        timestamp: '2026-11-14T03:14:40Z',
        sourceSystem: 'OMS_ORACLE',
        source: 'DEMO',
        summary: 'Zero voltage alarm triggered at DTR-TG-06U-104; legacy OMS alias OMS-XFMR-140 correlated.',
        targetStatus: 'FAULTED',
        latitude: 17.4435,
        longitude: 78.3772
      },
      {
        stepId: 'STEP-TG-05',
        stepNumber: 5,
        phase: 'AFFECTED_AREA',
        title: 'Affected Area & Tie-Switch Boundary Declared',
        assetId: 'SW-TG-06U-14',
        assetName: 'Cyber Gateway RMU Tie Switch-14 (DEMO)',
        timestamp: '2026-11-14T03:15:05Z',
        sourceSystem: 'LINEWORKER_RADIO',
        source: 'DEMO',
        summary: 'Sectionalizing boundary confirmed open at SW-TG-06U-14; 640 consumers isolated in HITEC City.',
        targetStatus: 'WARNING',
        latitude: 17.4412,
        longitude: 78.3792
      }
    ]
  },
  {
    id: 'EVT-KA-01U-01',
    faultId: 'FLT-KA-01U-01',
    faultCode: 'FLT-KA-01U-01',
    title: '11 kV Underground Cable Splice Fault on 100ft Road Feeder (DEMO)',
    description:
      'Insulation breakdown at 100ft Road underground cable joint caused CB-KA-01U-01 earth-fault lockout across Indiranagar.',
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    source: 'DEMO',
    detectedAt: '2026-11-14T04:02:11Z',
    substationId: 'SUB-KA-01U',
    feederId: 'FDR-KA-01U-01',
    affectedTransformerIds: ['DTR-KA-01U-301'],
    affectedAssetIds: ['SUB-KA-01U', 'CB-KA-01U-01', 'FDR-KA-01U-01', 'DTR-KA-01U-301'],
    affectedConsumersCount: 410,
    affectedAreaPolygon: buildBufferedAffectedPolygon([
      [12.9784, 77.6408],
      [12.9772, 77.641],
      [12.9749, 77.6412],
      [12.9712, 77.6416]
    ]),
    steps: [
      {
        stepId: 'STEP-KA-01',
        stepNumber: 1,
        phase: 'TRIGGER',
        title: 'Partial Discharge Pre-Fault Alarm',
        assetId: 'SUB-KA-01U',
        assetName: 'Indiranagar 132/33 kV Receiving Station (DEMO)',
        timestamp: '2026-11-14T04:02:11Z',
        sourceSystem: 'SCADA_OSI',
        source: 'DEMO',
        summary: 'Moisture ingress & partial discharge spike flagged on 11 kV busbar bay at SUB-KA-01U.',
        targetStatus: 'WARNING',
        latitude: 12.9784,
        longitude: 77.6408
      },
      {
        stepId: 'STEP-KA-02',
        stepNumber: 2,
        phase: 'PROTECTION_TRIP',
        title: 'Earth-Fault Relay Trip',
        assetId: 'CB-KA-01U-01',
        assetName: 'Indiranagar 11 kV Breaker-01 (DEMO)',
        timestamp: '2026-11-14T04:02:45Z',
        sourceSystem: 'SCADA_OSI',
        source: 'DEMO',
        summary: 'CB-KA-01U-01 opened automatically on 51N earth-fault pickup.',
        targetStatus: 'FAULTED',
        latitude: 12.9772,
        longitude: 77.641
      },
      {
        stepId: 'STEP-KA-03',
        stepNumber: 3,
        phase: 'FEEDER_LOCKOUT',
        title: '100ft Road Feeder De-Energized',
        assetId: 'FDR-KA-01U-01',
        assetName: '100ft Road 11 kV Commercial Feeder (DEMO)',
        timestamp: '2026-11-14T04:03:02Z',
        sourceSystem: 'SCADA_OSI',
        source: 'DEMO',
        summary: 'Feeder FDR-KA-01U-01 locked out along 100ft Road underground XLPE duct.',
        targetStatus: 'FAULTED',
        latitude: 12.9749,
        longitude: 77.6412
      },
      {
        stepId: 'STEP-KA-04',
        stepNumber: 4,
        phase: 'TRANSFORMER_OUTAGE',
        title: 'CMH Road DTR Supply Loss',
        assetId: 'DTR-KA-01U-301',
        assetName: 'CMH Road 500 kVA DTR-301 (DEMO)',
        timestamp: '2026-11-14T04:03:19Z',
        sourceSystem: 'OMS_ORACLE',
        source: 'DEMO',
        summary: 'DTR-KA-01U-301 de-energized; fault locator crew dispatched to CMH Road junction.',
        targetStatus: 'FAULTED',
        latitude: 12.9712,
        longitude: 77.6416
      },
      {
        stepId: 'STEP-KA-05',
        stepNumber: 5,
        phase: 'AFFECTED_AREA',
        title: 'Indiranagar Commercial Block Isolated',
        assetId: 'DTR-KA-01U-301',
        assetName: 'CMH Road 500 kVA DTR-301 (DEMO)',
        timestamp: '2026-11-14T04:04:00Z',
        sourceSystem: 'LINEWORKER_RADIO',
        source: 'DEMO',
        summary: 'Affected commercial corridor confirmed; 410 metered consumers impacted.',
        targetStatus: 'FAULTED',
        latitude: 12.9712,
        longitude: 77.6416
      }
    ]
  },
  {
    id: 'EVT-MH-01U-01',
    faultId: 'FLT-MH-01U-01',
    faultCode: 'FLT-MH-01U-01',
    title: 'Thermal Overload & Ground Fault on BKC G-Block Feeder (DEMO)',
    description:
      'Peak HVAC cooling load combined with ground-fault transient triggered protective isolation of BKC G-Block CSS DTR-401.',
    severity: 'WARNING',
    status: 'LINE_GROUNDED',
    source: 'DEMO',
    detectedAt: '2026-11-14T04:18:05Z',
    substationId: 'SUB-MH-01U',
    feederId: 'FDR-MH-01U-01',
    affectedTransformerIds: ['DTR-MH-01U-401'],
    affectedAssetIds: ['SUB-MH-01U', 'FDR-MH-01U-01', 'DTR-MH-01U-401'],
    affectedConsumersCount: null,
    affectedAreaPolygon: buildBufferedAffectedPolygon([
      [19.0662, 72.8674],
      [19.0631, 72.8648],
      [19.0604, 72.8622]
    ]),
    steps: [
      {
        stepId: 'STEP-MH-01',
        stepNumber: 1,
        phase: 'TRIGGER',
        title: 'Busbar Harmonic Sag Recorded',
        assetId: 'SUB-MH-01U',
        assetName: 'BKC 132/33 kV Receiving Station (DEMO)',
        timestamp: '2026-11-14T04:18:05Z',
        sourceSystem: 'SCADA_OSI',
        source: 'DEMO',
        summary: '33/11 kV busbar voltage dipped to 0.91 pu under peak BKC commercial load.',
        targetStatus: 'WARNING',
        latitude: 19.0662,
        longitude: 72.8674
      },
      {
        stepId: 'STEP-MH-02',
        stepNumber: 2,
        phase: 'FEEDER_LOCKOUT',
        title: 'Ground-Fault Current Excursion on Feeder',
        assetId: 'FDR-MH-01U-01',
        assetName: 'BKC G-Block 11 kV Feeder (DEMO)',
        timestamp: '2026-11-14T04:18:30Z',
        sourceSystem: 'SCADA_OSI',
        source: 'DEMO',
        summary: 'FDR-MH-01U-01 flagged line-grounded fault indicator near BKC G-Block.',
        targetStatus: 'FAULTED',
        latitude: 19.0631,
        longitude: 72.8648
      },
      {
        stepId: 'STEP-MH-03',
        stepNumber: 3,
        phase: 'TRANSFORMER_OUTAGE',
        title: 'CSS DTR-401 Ring Switch Isolated',
        assetId: 'DTR-MH-01U-401',
        assetName: 'BKC G-Block 1000 kVA CSS DTR-401 (DEMO)',
        timestamp: '2026-11-14T04:18:48Z',
        sourceSystem: 'SCADA_OSI',
        source: 'DEMO',
        summary: 'DTR-MH-01U-401 RMU breaker opened on thermal & earth-fault interlock.',
        targetStatus: 'FAULTED',
        latitude: 19.0604,
        longitude: 72.8622
      },
      {
        stepId: 'STEP-MH-04',
        stepNumber: 4,
        phase: 'AFFECTED_AREA',
        title: 'BKC G-Block Polygon Marked (Consumer Telemetry Pending)',
        assetId: 'DTR-MH-01U-401',
        assetName: 'BKC G-Block 1000 kVA CSS DTR-401 (DEMO)',
        timestamp: '2026-11-14T04:19:15Z',
        sourceSystem: 'OMS_ORACLE',
        source: 'DEMO',
        summary: 'Outage service polygon demarcated; AMI consumer count is pending synchronization.',
        targetStatus: 'FAULTED',
        latitude: 19.0604,
        longitude: 72.8622,
        hasContradiction: true,
        contradictionDetail: 'AMI consumer count stream offline — display fallback must read "Not available".'
      }
    ]
  }
];

export function buildEventReconstructionPayload(
  incident: EventReconstructionIncident,
  assets: InfrastructureAsset[],
  powerLines: PowerLine[]
) {
  const assetSet = new Set(incident.affectedAssetIds);
  const matchingAssets = assets.filter((a) => assetSet.has(a.canonicalId));
  const feederLine = incident.feederId
    ? powerLines.find((l) => l.canonicalId === incident.feederId || l.feederId === incident.feederId)
    : undefined;

  const polygonRing =
    incident.affectedAreaPolygon.length >= 3
      ? [...incident.affectedAreaPolygon, incident.affectedAreaPolygon[0]].map(([lat, lon]) => [
          lon,
          lat
        ])
      : [];

  return {
    id: incident.id,
    faultId: incident.faultId,
    faultCode: incident.faultCode,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    source: incident.source,
    detectedAt: incident.detectedAt,
    substationId: incident.substationId,
    feederId: incident.feederId,
    affectedTransformerIds: incident.affectedTransformerIds,
    affectedAssetIds: incident.affectedAssetIds,
    affectedConsumersCount: incident.affectedConsumersCount,
    affectedConsumersDisplay: formatMissingValue(incident.affectedConsumersCount, ' Consumers'),
    affectedAreaPolygon: incident.affectedAreaPolygon,
    steps: incident.steps,
    mapGeometry: {
      type: 'FeatureCollection' as const,
      features: [
        ...matchingAssets.map((a) => ({
          type: 'Feature' as const,
          id: a.canonicalId,
          geometry: a.geometry,
          properties: {
            role: 'affected_asset',
            canonicalId: a.canonicalId,
            assetType: a.assetType,
            name: formatMissingValue(a.rawName ?? a.name),
            source: a.source
          }
        })),
        ...(feederLine
          ? [
              {
                type: 'Feature' as const,
                id: `${feederLine.canonicalId}-corridor`,
                geometry: {
                  type: 'LineString' as const,
                  coordinates: feederLine.path.map(([lat, lon]) => [lon, lat])
                },
                properties: {
                  role: 'affected_feeder',
                  canonicalId: feederLine.canonicalId,
                  source: feederLine.source
                }
              }
            ]
          : []),
        ...(polygonRing.length >= 4
          ? [
              {
                type: 'Feature' as const,
                id: `${incident.id}-affected-area`,
                geometry: {
                  type: 'Polygon' as const,
                  coordinates: [polygonRing]
                },
                properties: {
                  role: 'affected_area',
                  eventId: incident.id,
                  source: incident.source
                }
              }
            ]
          : [])
      ]
    }
  };
}

const SEED_SIM_CONTEXT = {
  assets: INITIAL_ASSETS,
  powerLines: INITIAL_POWER_LINES,
  faults: INITIAL_FAULTS,
  reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
  issues: INITIAL_DATA_QUALITY_ISSUES
};

export const INITIAL_SIMULATION_SCENARIOS: SimulationScenario[] = [
  executeWhatIfSimulation(
    {
      scenarioType: 'FEEDER_TRANSFER',
      title: 'Backfeed FDR-TG-06U-01 Segment to FDR-TG-06U-02 via SW-TG-06U-14 (DEMO)',
      substationId: 'SUB-TG-06U',
      sourceFeeder: 'FDR-TG-06U-01',
      targetFeeder: 'FDR-TG-06U-02',
      transformerId: 'DTR-TG-06U-104',
      tieSwitch: 'SW-TG-06U-14',
      loadTransferMva: 3.4,
      loadTransferPct: 70,
      expectedDurationMin: 12,
      timeOfOperation: '2026-11-14T03:20:00Z',
      incidentId: 'EVT-TG-06U-01',
      faultId: 'FLT-TG-06U-01',
      engineerName: 'Marcus Vance, PE (Grid Engineer)',
      engineerEmail: 'm.vance@utilitygrid.org'
    },
    SEED_SIM_CONTEXT,
    {
      id: 'SCEN-TG-06U-01',
      scenarioCode: 'SCEN-TG-06U-01',
      source: 'DEMO',
      createdAt: '2026-11-14T03:20:00Z',
      status: 'COMPLETED'
    }
  ),
  executeWhatIfSimulation(
    {
      scenarioType: 'ALTERNATIVE_SUPPLY',
      title: 'Alternative Supply via Gachibowli Feeder FDR-TG-07D-01 for DTR-TG-06U-104 (DEMO)',
      substationId: 'SUB-TG-06U',
      sourceFeeder: 'FDR-TG-06U-01',
      targetFeeder: 'FDR-TG-07D-01',
      transformerId: 'DTR-TG-06U-104',
      tieSwitch: 'SW-TG-06U-14',
      loadTransferMva: 4.5,
      loadTransferPct: 85,
      expectedDurationMin: 22,
      timeOfOperation: '2026-11-14T03:35:00Z',
      incidentId: 'EVT-TG-06U-01',
      faultId: 'FLT-TG-06U-01',
      engineerName: 'Marcus Vance, PE (Grid Engineer)',
      engineerEmail: 'm.vance@utilitygrid.org'
    },
    SEED_SIM_CONTEXT,
    {
      id: 'SCEN-TG-06U-02',
      scenarioCode: 'SCEN-TG-06U-02',
      source: 'DEMO',
      createdAt: '2026-11-14T03:35:00Z',
      status: 'COMPLETED'
    }
  )
];

export const INITIAL_ENGINEERING_DECISIONS: EngineeringDecision[] = [
  {
    id: 'DEC-TG-06U-01',
    decisionCode: 'DEC-TG-06U-01',
    incidentId: 'EVT-TG-06U-01',
    faultId: 'FLT-TG-06U-01',
    title: 'Close Tie Switch SW-TG-06U-14 to Restore DTR-TG-06U-104 via FDR-TG-06U-02 (DEMO)',
    rationale:
      'Demo proposal: Transfers 3.4 MVA load segment onto healthy 11 kV feeder FDR-TG-06U-02 within 14 MVA capacity.',
    riskAssessment: 'Advisory demo proposal only; requires field zero-energy verification.',
    recommendationSummary: 'Isolate faulted segment on FDR-TG-06U-01 and backfeed DTR-TG-06U-104 via SW-TG-06U-14.',
    targetAssetId: 'SW-TG-06U-14',
    priority: 'CRITICAL',
    riskLevel: 'MEDIUM',
    escalated: true,
    escalationReason: '640 commercial IT park accounts impacted; legacy OMS alias discrepancy flagged.',
    assignedTaskId: null,
    state: 'Telangana',
    district: 'Hyderabad',
    area: 'HITEC City',
    proposedBy: 'Marcus Vance, PE',
    proposedByEmail: 'm.vance@utilitygrid.org',
    status: 'SUBMITTED',
    source: 'DEMO',
    evidenceBundle: {
      conflictIssueIds: ['DQI-TG-06U-104'],
      eventTimelineIds: ['EVT-TG-06U-01', 'EVT-TG-06U-02'],
      simulationScenarioId: 'SCEN-TG-06U-01',
      affectedCustomersCount: 640,
      reliabilityImpact: 'Demo restoration estimate for 640 downstream customers.'
    },
    signatureHash: 'demo-sha256-9a3f8c2e1b7d40a2c5f8e1d9b4a7c3f0e2d1b6a8',
    createdAt: '2026-11-14T03:25:00Z',
    updatedAt: '2026-11-14T03:25:00Z',
    comments: [
      {
        author: 'Marcus Vance, PE',
        role: 'GRID_ENGINEER',
        timestamp: '2026-11-14T03:25:00Z',
        text: 'Demo proposal linked to canonical assets SUB-TG-06U -> FDR-TG-06U-01 -> DTR-TG-06U-104.'
      }
    ]
  },
  {
    id: 'DEC-KA-01U-01',
    decisionCode: 'DEC-KA-01U-01',
    incidentId: 'EVT-KA-01U-01',
    faultId: 'FLT-KA-01U-01',
    title: 'Dispatch Cable Jointing Crew & Sectionalize CMH Road DTR-KA-01U-301 (DEMO)',
    rationale:
      'Earth-fault trip on CB-KA-01U-01 requires underground splice chamber thermal inspection and megger test before re-energization.',
    riskAssessment: 'Medium switching risk; crew must verify earth isolation and lock-out tag-out on FDR-KA-01U-01.',
    recommendationSummary: 'Conduct IR & sheath continuity inspection at CMH Road RMU pit before test energization.',
    targetAssetId: 'DTR-KA-01U-301',
    priority: 'HIGH',
    riskLevel: 'MEDIUM',
    escalated: false,
    assignedTaskId: 'TSK-KA-01U-01',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    area: 'Indiranagar',
    proposedBy: 'Marcus Vance, PE',
    proposedByEmail: 'm.vance@utilitygrid.org',
    reviewedBy: 'Sarah Jenkins, PE (Utility Manager)',
    reviewedByEmail: 's.jenkins@utilitygrid.org',
    status: 'IN_PROGRESS',
    source: 'DEMO',
    evidenceBundle: {
      conflictIssueIds: [],
      eventTimelineIds: ['EVT-KA-01U-01'],
      simulationScenarioId: 'SCEN-TG-06U-01',
      affectedCustomersCount: 410,
      reliabilityImpact: 'Restores 410 Indiranagar commercial accounts following cable splice remediation.'
    },
    signatureHash: 'demo-sha256-4b1e7c90a2d58f31c6e4b8a1d7f02e5c9a4b3d8e',
    createdAt: '2026-11-14T04:12:00Z',
    updatedAt: '2026-11-14T04:20:00Z',
    comments: [
      {
        author: 'Marcus Vance, PE',
        role: 'GRID_ENGINEER',
        timestamp: '2026-11-14T04:12:00Z',
        text: 'Submitted field inspection and splice repair proposal for DTR-KA-01U-301.'
      },
      {
        author: 'Sarah Jenkins, PE (Utility Manager)',
        role: 'REVIEWER_APPROVER',
        timestamp: '2026-11-14T04:20:00Z',
        text: 'APPROVED: Dispatched Field Operations Team Alpha-BLR under TSK-KA-01U-01.'
      }
    ]
  },
  {
    id: 'DEC-MH-01U-01',
    decisionCode: 'DEC-MH-01U-01',
    incidentId: 'EVT-MH-01U-01',
    faultId: 'FLT-MH-01U-01',
    title: 'BKC G-Block CSS DTR-401 Relay Reset & Load Balancing Verification (DEMO)',
    rationale:
      'Ground fault transient cleared after bushing insulator cleaning and neutral earthing check at BKC G-Block compact substation.',
    riskAssessment: 'Low residual risk after verified 5 kV insulation resistance pass (> 1,200 MΩ).',
    recommendationSummary: 'Complete post-repair verification checklist and restore normal 11 kV bus feed.',
    targetAssetId: 'DTR-MH-01U-401',
    priority: 'HIGH',
    riskLevel: 'LOW',
    escalated: false,
    assignedTaskId: 'TSK-MH-01U-01',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    area: 'Bandra Kurla Complex',
    proposedBy: 'Marcus Vance, PE',
    proposedByEmail: 'm.vance@utilitygrid.org',
    reviewedBy: 'Sarah Jenkins, PE (Utility Manager)',
    reviewedByEmail: 's.jenkins@utilitygrid.org',
    status: 'CLOSED',
    source: 'DEMO',
    evidenceBundle: {
      conflictIssueIds: [],
      eventTimelineIds: ['EVT-MH-01U-01'],
      affectedCustomersCount: null,
      reliabilityImpact: 'BKC G-Block 1000 kVA CSS restored to nominal load.'
    },
    verificationChecklist: {
      faultResolved: true,
      equipmentTested: true,
      powerRestored: true,
      safetyChecksCompleted: true,
      documentationCompleted: true,
      verifiedBy: 'Sarah Jenkins, PE (Utility Manager)',
      verifiedAt: '2026-11-14T05:10:00Z',
      verificationNotes: 'Field megger reading 1,420 MΩ verified. Grounding clamps torqued and feeder re-closed.'
    },
    resolutionSummary: 'Bushing flashover surface cleaned, arrestor replaced, and normal supply verified.',
    resolutionTimeMinutes: 48,
    closedAt: '2026-11-14T05:10:00Z',
    closedBy: 'Sarah Jenkins, PE (Utility Manager)',
    signatureHash: 'demo-sha256-8e2d5a1c4f9b7301e6a2d8c5b4f7091e3a6c5d2f',
    createdAt: '2026-11-14T04:22:00Z',
    updatedAt: '2026-11-14T05:10:00Z',
    comments: [
      {
        author: 'Sarah Jenkins, PE (Utility Manager)',
        role: 'REVIEWER_APPROVER',
        timestamp: '2026-11-14T05:10:00Z',
        text: 'CASE VERIFIED & CLOSED: All 5 mandatory safety and restoration checks passed.'
      }
    ]
  },
  {
    id: 'DEC-TG-07D-01',
    decisionCode: 'DEC-TG-07D-01',
    incidentId: 'EVT-TG-06U-01',
    faultId: 'FLT-TG-06U-01',
    title: 'Direct 9.8 MVA Bulk Backfeed Transfer onto Gachibowli FDR-TG-07D-01 (DEMO)',
    rationale:
      'Alternative bulk transfer tested in SCEN-TG-06U-02 to route HITEC City load onto adjacent Gachibowli 33/11 kV substation.',
    riskAssessment: 'HIGH RISK: Violates 11 kV feeder thermal ceiling (>95% loading) and depresses tail bus voltage.',
    recommendationSummary: 'Rejected in favor of partial 3.4 MVA transfer via FDR-TG-06U-02.',
    targetAssetId: 'FDR-TG-07D-01',
    priority: 'MEDIUM',
    riskLevel: 'HIGH',
    escalated: false,
    assignedTaskId: null,
    state: 'Telangana',
    district: 'Hyderabad',
    area: 'Gachibowli',
    proposedBy: 'Marcus Vance, PE',
    proposedByEmail: 'm.vance@utilitygrid.org',
    reviewedBy: 'Sarah Jenkins, PE (Utility Manager)',
    reviewedByEmail: 's.jenkins@utilitygrid.org',
    status: 'REJECTED',
    source: 'DEMO',
    evidenceBundle: {
      conflictIssueIds: [],
      eventTimelineIds: ['EVT-TG-06U-01'],
      simulationScenarioId: 'SCEN-TG-06U-02',
      affectedCustomersCount: 640,
      reliabilityImpact: 'Rejected due to thermal overload margin violation.'
    },
    signatureHash: 'demo-sha256-3c7f1a9d4e8b2056f1c3a7d9e2b4801f5c6a9d3e',
    createdAt: '2026-11-14T03:40:00Z',
    updatedAt: '2026-11-14T03:48:00Z',
    comments: [
      {
        author: 'Sarah Jenkins, PE (Utility Manager)',
        role: 'REVIEWER_APPROVER',
        timestamp: '2026-11-14T03:48:00Z',
        text: 'REJECTED: Thermal constraint breach flagged in SCEN-TG-06U-02. Use Mindspace FDR-TG-06U-02 instead.'
      }
    ]
  }
];

export const INITIAL_APPROVALS: ApprovalRecord[] = [
  {
    id: 'APR-DEMO-001',
    decisionId: 'DEC-KA-01U-01',
    decisionCode: 'DEC-KA-01U-01',
    action: 'APPROVED',
    approverName: 'Sarah Jenkins, PE (Utility Manager)',
    approverEmail: 's.jenkins@utilitygrid.org',
    approverRole: 'REVIEWER_APPROVER',
    comments: 'Approved cable splice inspection & field dispatch under TSK-KA-01U-01.',
    timestamp: '2026-11-14T04:20:00Z',
    signatureHash: 'demo-sha256-4b1e7c90a2d58f31c6e4b8a1d7f02e5c9a4b3d8e'
  },
  {
    id: 'APR-DEMO-002',
    decisionId: 'DEC-MH-01U-01',
    decisionCode: 'DEC-MH-01U-01',
    action: 'APPROVED',
    approverName: 'Sarah Jenkins, PE (Utility Manager)',
    approverEmail: 's.jenkins@utilitygrid.org',
    approverRole: 'REVIEWER_APPROVER',
    comments: 'Approved BKC CSS DTR-401 bushing remediation and verification protocol.',
    timestamp: '2026-11-14T04:28:00Z',
    signatureHash: 'demo-sha256-8e2d5a1c4f9b7301e6a2d8c5b4f7091e3a6c5d2f'
  },
  {
    id: 'APR-DEMO-003',
    decisionId: 'DEC-TG-07D-01',
    decisionCode: 'DEC-TG-07D-01',
    action: 'REJECTED',
    approverName: 'Sarah Jenkins, PE (Utility Manager)',
    approverEmail: 's.jenkins@utilitygrid.org',
    approverRole: 'REVIEWER_APPROVER',
    comments: 'Rejected due to thermal capacity exceedance on Gachibowli FDR-TG-07D-01.',
    timestamp: '2026-11-14T03:48:00Z',
    signatureHash: 'demo-sha256-3c7f1a9d4e8b2056f1c3a7d9e2b4801f5c6a9d3e'
  }
];

export const INITIAL_FIELD_TASKS: FieldTask[] = [
  {
    id: 'TSK-KA-01U-01',
    taskCode: 'TSK-KA-01U-01',
    decisionId: 'DEC-KA-01U-01',
    decisionCode: 'DEC-KA-01U-01',
    incidentId: 'EVT-KA-01U-01',
    faultId: 'FLT-KA-01U-01',
    title: 'Inspect 11 kV Underground Splice & Megger Test CMH Road DTR-301',
    assignedEngineer: 'Rohan Kulkarni (Field Engineer)',
    assignedEngineerEmail: 'r.kulkarni@utilitygrid.org',
    assignedTeam: 'Bengaluru East Rapid Response Crew-02',
    assetId: 'DTR-KA-01U-301',
    assetName: 'CMH Road 500 kVA DTR-301 (DEMO)',
    faultLocation: 'CMH Road, Indiranagar, Bengaluru Urban, Karnataka 560038',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    area: 'Indiranagar',
    gpsLat: 12.9712,
    gpsLon: 77.6416,
    navigationRoute: [
      { step: 'Depart BESCOM Indiranagar Depot eastbound onto 100ft Road', distanceLabel: '0.4 km' },
      { step: 'Turn right at CMH Road Junction past Indiranagar Metro Pillar 114', distanceLabel: '0.6 km' },
      { step: 'Locate RMU Pit #12 adjacent to CMH Road 500 kVA DTR-301', distanceLabel: '0.2 km' }
    ],
    safetyNotes: 'Confirm CB-KA-01U-01 racked out & earthed at SUB-KA-01U. Test for zero voltage on all 3 phases before opening RMU bay.',
    maintenanceHistoryNotes: 'Last routine thermography inspection completed 2026-10-09; minor moisture ingress noted on cable box seal.',
    previousIncidentsSummary: 'No prior trips in past 12 months; cable joint installed 2020-07-30.',
    scheduledTime: '2026-11-14T04:30:00Z',
    dueDate: '2026-11-14T07:30:00Z',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    source: 'DEMO',
    createdAt: '2026-11-14T04:20:00Z',
    updatedAt: '2026-11-14T04:36:00Z',
    startedAt: '2026-11-14T04:36:00Z'
  },
  {
    id: 'TSK-MH-01U-01',
    taskCode: 'TSK-MH-01U-01',
    decisionId: 'DEC-MH-01U-01',
    decisionCode: 'DEC-MH-01U-01',
    incidentId: 'EVT-MH-01U-01',
    faultId: 'FLT-MH-01U-01',
    title: 'BKC G-Block CSS DTR-401 Bushing Cleaning & Ground Continuity Check',
    assignedEngineer: 'Ananya Deshmukh (Field Engineer)',
    assignedEngineerEmail: 'a.deshmukh@utilitygrid.org',
    assignedTeam: 'Mumbai Suburban BKC Field Unit-01',
    assetId: 'DTR-MH-01U-401',
    assetName: 'BKC G-Block 1000 kVA CSS DTR-401 (DEMO)',
    faultLocation: 'G-Block, Bandra Kurla Complex, Mumbai Suburban, Maharashtra 400051',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    area: 'Bandra Kurla Complex',
    gpsLat: 19.0604,
    gpsLon: 72.8622,
    navigationRoute: [
      { step: 'Enter BKC Avenue 3 from Western Express Highway connector', distanceLabel: '1.1 km' },
      { step: 'Proceed to G-Block Compact Substation Enclosure #4', distanceLabel: '0.3 km' }
    ],
    safetyNotes: 'Maintain 11 kV arc-flash PPE category 2; isolate feeder FDR-MH-01U-01 before terminal torque verification.',
    maintenanceHistoryNotes: 'Annual dissolved gas analysis passed 2026-09-18.',
    previousIncidentsSummary: 'Transient ground alarm logged 2026-06-14 during coastal humidity surge.',
    scheduledTime: '2026-11-14T04:30:00Z',
    dueDate: '2026-11-14T06:30:00Z',
    priority: 'HIGH',
    status: 'VERIFIED',
    source: 'DEMO',
    createdAt: '2026-11-14T04:28:00Z',
    updatedAt: '2026-11-14T05:10:00Z',
    startedAt: '2026-11-14T04:34:00Z',
    completedAt: '2026-11-14T05:02:00Z',
    verifiedAt: '2026-11-14T05:10:00Z',
    verifiedBy: 'Sarah Jenkins, PE (Utility Manager)',
    completionNotes: 'Cleaned HV porcelain bushing flashover tracking, replaced surge arrestor on B-phase, verified IR > 1,400 MΩ.'
  }
];

export const INITIAL_FIELD_EVIDENCE: FieldEvidence[] = [
  {
    id: 'EVD-DEMO-001',
    taskId: 'TSK-KA-01U-01',
    taskCode: 'TSK-KA-01U-01',
    decisionId: 'DEC-KA-01U-01',
    fileName: 'cmh-road-splice-thermal-scan.png',
    mimeType: 'image/png',
    fileSizeBytes: 248320,
    gpsLat: 12.9712,
    gpsLon: 77.6416,
    notes: 'Confirmed zero-voltage lockout at RMU Pit #12; elevated moisture observed on B-phase heat-shrink sleeve.',
    inspectionResult: 'FURTHER_WORK_REQUIRED',
    equipmentCondition: 'DEGRADED',
    meterReadings: {
      voltageKv: '0.00 kV (Earthed)',
      loadAmps: '0 A',
      insulationMohm: '420 MΩ',
      temperatureC: '46.2 °C'
    },
    uploadedBy: 'Rohan Kulkarni (Field Engineer)',
    uploadedByEmail: 'r.kulkarni@utilitygrid.org',
    uploadedAt: '2026-11-14T04:45:00Z',
    source: 'DEMO'
  },
  {
    id: 'EVD-DEMO-002',
    taskId: 'TSK-MH-01U-01',
    taskCode: 'TSK-MH-01U-01',
    decisionId: 'DEC-MH-01U-01',
    fileName: 'bkc-css-dtr401-post-repair-megger.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 184900,
    gpsLat: 19.0604,
    gpsLon: 72.8622,
    notes: 'Post-repair 5 kV megger test passed cleanly; surge arrestor replaced and CSS energized normally.',
    inspectionResult: 'REPAIR_COMPLETED',
    equipmentCondition: 'GOOD',
    meterReadings: {
      voltageKv: '11.02 kV',
      loadAmps: '312 A',
      insulationMohm: '1,420 MΩ',
      temperatureC: '34.8 °C'
    },
    uploadedBy: 'Ananya Deshmukh (Field Engineer)',
    uploadedByEmail: 'a.deshmukh@utilitygrid.org',
    uploadedAt: '2026-11-14T05:01:00Z',
    source: 'DEMO'
  }
];

export const INITIAL_NOTIFICATIONS: GridNotification[] = [
  {
    id: 'NTF-DEMO-001',
    type: 'APPROVAL_REQUIRED',
    title: 'Approval Required: DEC-TG-06U-01',
    message: 'Tie-switch closure proposal for HITEC City DTR-TG-06U-104 (640 accounts) awaits Utility Manager sign-off.',
    severity: 'CRITICAL',
    timestamp: '2026-11-14T03:25:00Z',
    read: false,
    relatedAssetId: 'SW-TG-06U-14',
    relatedIncidentId: 'EVT-TG-06U-01',
    relatedDecisionId: 'DEC-TG-06U-01',
    targetView: 'decisions',
    source: 'DEMO'
  },
  {
    id: 'NTF-DEMO-002',
    type: 'TASK_ASSIGNED',
    title: 'Field Task Assigned: TSK-KA-01U-01',
    message: 'Bengaluru East Crew-02 dispatched to CMH Road DTR-KA-01U-301 for underground splice inspection.',
    severity: 'WARNING',
    timestamp: '2026-11-14T04:20:00Z',
    read: false,
    relatedAssetId: 'DTR-KA-01U-301',
    relatedIncidentId: 'EVT-KA-01U-01',
    relatedDecisionId: 'DEC-KA-01U-01',
    relatedTaskId: 'TSK-KA-01U-01',
    targetView: 'field',
    source: 'DEMO'
  },
  {
    id: 'NTF-DEMO-003',
    type: 'INCIDENT_RESOLVED',
    title: 'Case Verified & Closed: DEC-MH-01U-01',
    message: 'BKC G-Block DTR-MH-01U-401 passed 5-point verification checklist and returned to normal service.',
    severity: 'INFO',
    timestamp: '2026-11-14T05:10:00Z',
    read: true,
    relatedAssetId: 'DTR-MH-01U-401',
    relatedIncidentId: 'EVT-MH-01U-01',
    relatedDecisionId: 'DEC-MH-01U-01',
    relatedTaskId: 'TSK-MH-01U-01',
    targetView: 'decisions',
    source: 'DEMO'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'AUD-DEMO-004',
    timestamp: '2026-11-14T05:10:00Z',
    actorEmail: 's.jenkins@utilitygrid.org',
    actorRole: 'REVIEWER_APPROVER',
    actionType: 'INCIDENT_CLOSED',
    module: 'Decision Governance',
    targetEntity: 'engineering_decisions',
    entityId: 'DEC-MH-01U-01',
    relatedAssetId: 'DTR-MH-01U-401',
    relatedIncidentId: 'EVT-MH-01U-01',
    summary: 'Verified 5-point restoration checklist and closed DEC-MH-01U-01 (TSK-MH-01U-01).',
    ipAddress: '127.0.0.1'
  },
  {
    id: 'AUD-DEMO-003',
    timestamp: '2026-11-14T04:45:00Z',
    actorEmail: 'r.kulkarni@utilitygrid.org',
    actorRole: 'FIELD_ENGINEER',
    actionType: 'EVIDENCE_UPLOADED',
    module: 'Field Operations',
    targetEntity: 'field_evidence',
    entityId: 'EVD-DEMO-001',
    relatedAssetId: 'DTR-KA-01U-301',
    relatedIncidentId: 'EVT-KA-01U-01',
    summary: 'Uploaded thermal inspection evidence for TSK-KA-01U-01 at GPS 12.9712, 77.6416.',
    ipAddress: '127.0.0.1'
  },
  {
    id: 'AUD-DEMO-002',
    timestamp: '2026-11-14T04:20:00Z',
    actorEmail: 's.jenkins@utilitygrid.org',
    actorRole: 'REVIEWER_APPROVER',
    actionType: 'FIELD_TASK_ASSIGNED',
    module: 'Field Operations',
    targetEntity: 'field_tasks',
    entityId: 'TSK-KA-01U-01',
    relatedAssetId: 'DTR-KA-01U-301',
    relatedIncidentId: 'EVT-KA-01U-01',
    summary: 'Approved DEC-KA-01U-01 and assigned Field Task TSK-KA-01U-01 to Bengaluru East Crew-02.',
    ipAddress: '127.0.0.1'
  },
  {
    id: 'AUD-DEMO-001',
    timestamp: '2026-11-14T03:25:00Z',
    actorEmail: 'm.vance@utilitygrid.org',
    actorRole: 'GRID_ENGINEER',
    actionType: 'DECISION_SUBMITTED',
    module: 'Decision Governance',
    targetEntity: 'engineering_decisions',
    entityId: 'DEC-TG-06U-01',
    relatedAssetId: 'SW-TG-06U-14',
    relatedIncidentId: 'EVT-TG-06U-01',
    summary: 'Submitted DEMO engineering proposal DEC-TG-06U-01 targeting SW-TG-06U-14.',
    ipAddress: '127.0.0.1'
  }
];

export const INITIAL_STATS: SystemStats = {
  totalAssets: INITIAL_ASSETS.length,
  dataQualityScore: 95.8,
  activeConflictsCount: INITIAL_DATA_QUALITY_ISSUES.length + INITIAL_FAULTS.length,
  reconstructedEventsCount: INITIAL_OPERATIONAL_EVENTS.length,
  activeScenariosCount: INITIAL_SIMULATION_SCENARIOS.length,
  pendingApprovalsCount: INITIAL_ENGINEERING_DECISIONS.filter(
    (d) => d.status === 'SUBMITTED' || d.status === 'PENDING_REVIEW'
  ).length,
  orphanedAssetsCount: 0
};

export function osmPowerTypeToAssetType(type: OsmPowerType): AssetType {
  switch (type) {
    case 'substation':
      return 'SUBSTATION';
    case 'plant':
      return 'PLANT';
    case 'generator':
      return 'GENERATOR';
    case 'transformer':
      return 'TRANSFORMER';
    case 'switch':
      return 'SECTIONALIZER';
    case 'converter':
    case 'compensator':
    case 'portal':
    case 'busbar':
    case 'bay':
    case 'terminal':
    case 'insulator':
    case 'connection':
    case 'cabinet':
      return 'ELECTRICAL_EQUIPMENT';
    case 'tower':
      return 'TOWER';
    case 'pole':
      return 'POLE';
    case 'line':
    case 'minor_line':
    case 'cable':
      return 'FEEDER';
    default:
      return 'LOAD_POINT';
  }
}

export function parseVoltageKv(voltage: string | null): number | null {
  if (!voltage) return null;
  const firstToken = voltage.split(/[;/,]/)[0]?.trim();
  if (!firstToken) return null;
  const numeric = Number(firstToken.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric >= 1000 ? Number((numeric / 1000).toFixed(2)) : numeric;
}

export function normalizeOsmToInfrastructureAsset(
  osm: OsmAsset,
  contextHint?: {
    country?: string;
    state?: string;
    district?: string;
    city?: string;
    area?: string;
  }
): InfrastructureAsset {
  const assetType = osmPowerTypeToAssetType(osm.type);
  const displayName = osm.name ?? 'Not available';
  const voltageKv = parseVoltageKv(osm.voltage);
  const missingCriticalTag =
    (osm.type === 'substation' || osm.type === 'transformer' || osm.type === 'plant') &&
    (!osm.voltage || !osm.operator);

  return {
    id: osm.id,
    canonicalId: osm.id,
    name: displayName,
    rawName: osm.name,
    osmType: osm.type,
    assetType,
    substationId: osm.type === 'substation' ? osm.id : null,
    feederId:
      osm.type === 'line' || osm.type === 'minor_line' || osm.type === 'cable'
        ? osm.id
        : null,
    voltage: osm.voltage,
    operator: osm.operator,
    nominalVoltageKv: voltageKv,
    ratedCapacityKva: null,
    peakLoadPct: null,
    status: 'UNKNOWN',
    latitude: osm.lat,
    longitude: osm.lon,
    geometry: osm.geometry,
    source: 'OSM',
    tags: osm.tags,
    country: contextHint?.country || 'India',
    state: contextHint?.state || 'Not available',
    district: contextHint?.district || 'Not available',
    city: contextHint?.city || 'Not available',
    area: contextHint?.area || 'Not available',
    utilityServiceArea: osm.operator ?? undefined,
    installationDate: null,
    lastInspectionDate: null,
    hasConflict: missingCriticalTag,
    sourceAliases: [{ system: 'OSM_OVERPASS', aliasId: osm.id }]
  };
}

export function normalizeOsmToPowerLine(osm: OsmAsset): PowerLine | null {
  if (
    osm.geometry.type !== 'LineString' ||
    (osm.type !== 'line' && osm.type !== 'minor_line' && osm.type !== 'cable')
  ) {
    return null;
  }

  return {
    id: osm.id,
    canonicalId: osm.id,
    name: osm.name ?? `OSM ${osm.type}`,
    rawName: osm.name,
    osmType: osm.type,
    substationId: null,
    feederId: osm.id,
    voltage: osm.voltage,
    operator: osm.operator,
    voltageKv: parseVoltageKv(osm.voltage),
    status: 'ENERGIZED',
    path: osm.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    source: 'OSM'
  };
}

export function buildOsmTagIntegrityIssues(osmAssets: OsmAsset[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const detectedAt = new Date().toISOString();

  for (const asset of osmAssets) {
    if (
      asset.type !== 'substation' &&
      asset.type !== 'transformer' &&
      asset.type !== 'plant' &&
      asset.type !== 'line'
    ) {
      continue;
    }

    if (!asset.voltage) {
      issues.push({
        id: `osm-tag-voltage-${asset.id}`,
        issueType: 'MISSING_OSM_TAG',
        severity: asset.type === 'substation' ? 'CRITICAL' : 'WARNING',
        canonicalAssetId: asset.id,
        assetName: asset.name ?? `Not available (${asset.type})`,
        conflictingSourceA: 'OSM_OVERPASS',
        conflictingValueA: 'Not available',
        conflictingSourceB: 'GRID_MODEL_REQUIREMENT',
        conflictingValueB: 'voltage tag required',
        explanation: `OpenStreetMap element ${asset.id} (${asset.type}) does not have a mapped "voltage" tag.`,
        status: 'DETECTED',
        detectedAt,
        source: 'OSM'
      });
    } else if (!asset.operator) {
      issues.push({
        id: `osm-tag-operator-${asset.id}`,
        issueType: 'MISSING_OSM_TAG',
        severity: 'INFO',
        canonicalAssetId: asset.id,
        assetName: asset.name ?? `Not available (${asset.type})`,
        conflictingSourceA: 'OSM_OVERPASS',
        conflictingValueA: 'Not available',
        conflictingSourceB: 'DISCOM_REGISTRY',
        conflictingValueB: 'operator tag recommended',
        explanation: `OpenStreetMap element ${asset.id} (${asset.type}) does not have a mapped "operator" tag.`,
        status: 'DETECTED',
        detectedAt,
        source: 'OSM'
      });
    }

    if (issues.length >= 25) break;
  }

  return issues;
}

/**
 * Resolves the full connected topology path (substation -> feeder -> transformer/switches)
 * for any selected asset using canonical IDs.
 */
export function getConnectedPathForAsset(
  selectedId: string | null,
  assets: InfrastructureAsset[],
  powerLines: PowerLine[]
): {
  nodeIds: Set<string>;
  lineIds: Set<string>;
} {
  const nodeIds = new Set<string>();
  const lineIds = new Set<string>();

  if (!selectedId) {
    return { nodeIds, lineIds };
  }

  const target = assets.find((a) => a.canonicalId === selectedId || a.id === selectedId);
  if (!target) {
    // Check if selectedId corresponds directly to a PowerLine
    const line = powerLines.find((l) => l.canonicalId === selectedId || l.id === selectedId);
    if (line) {
      lineIds.add(line.canonicalId);
      nodeIds.add(line.canonicalId);
      if (line.substationId) nodeIds.add(line.substationId);
      for (const a of assets) {
        if (a.feederId === line.feederId || a.canonicalId === line.substationId) {
          nodeIds.add(a.canonicalId);
        }
      }
    }
    return { nodeIds, lineIds };
  }

  nodeIds.add(target.canonicalId);

  if (target.assetType === 'SUBSTATION' || target.assetType === 'PLANT') {
    const subId = target.canonicalId;
    for (const a of assets) {
      if (a.substationId === subId || a.canonicalId === subId) {
        nodeIds.add(a.canonicalId);
        if (a.assetType === 'FEEDER') {
          lineIds.add(a.canonicalId);
        }
      }
    }
    for (const line of powerLines) {
      if (line.substationId === subId || nodeIds.has(line.feederId)) {
        lineIds.add(line.canonicalId);
      }
    }
    return { nodeIds, lineIds };
  }

  if (target.assetType === 'FEEDER') {
    const fdrId = target.canonicalId;
    lineIds.add(fdrId);
    if (target.substationId) {
      nodeIds.add(target.substationId);
    }
    for (const a of assets) {
      if (
        a.feederId === fdrId ||
        a.canonicalId === fdrId ||
        (target.substationId && a.canonicalId === target.substationId)
      ) {
        nodeIds.add(a.canonicalId);
      }
    }
    for (const line of powerLines) {
      if (line.feederId === fdrId || line.canonicalId === fdrId) {
        lineIds.add(line.canonicalId);
      }
    }
    return { nodeIds, lineIds };
  }

  // Leaf asset (TRANSFORMER, CIRCUIT_BREAKER, SECTIONALIZER, RECLOSER, etc.):
  // Highlight upstream Feeder + Substation AND sibling devices on that Feeder chain
  if (target.substationId) {
    nodeIds.add(target.substationId);
  }
  if (target.feederId) {
    nodeIds.add(target.feederId);
    lineIds.add(target.feederId);
    for (const a of assets) {
      if (a.feederId === target.feederId || a.canonicalId === target.feederId) {
        nodeIds.add(a.canonicalId);
      }
    }
    for (const line of powerLines) {
      if (line.feederId === target.feederId || line.canonicalId === target.feederId) {
        lineIds.add(line.canonicalId);
      }
    }
  }

  return { nodeIds, lineIds };
}
