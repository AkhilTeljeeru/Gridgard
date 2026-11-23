import type { GeographicBoundary } from '../types/grid.ts';
import {
  buildAllIndiaDistrictBoundaries,
  buildAllIndiaStateBoundaries
} from './indiaGeographyRegistry.ts';

const CURATED_DISTRICT_AND_LOCAL_BOUNDARIES: GeographicBoundary[] = [
  // =========================================================================
  // 2. DISTRICT BOUNDARIES
  // =========================================================================
  {
    id: 'bnd-dist-hyd',
    name: 'Hyderabad District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    coordinates: [
      [17.50, 78.31], [17.51, 78.44], [17.47, 78.53], [17.39, 78.55],
      [17.33, 78.49], [17.34, 78.38], [17.40, 78.31]
    ]
  },
  {
    id: 'bnd-dist-wgl',
    name: 'Warangal District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Telangana',
    district: 'Warangal',
    coordinates: [
      [18.12, 79.48], [18.13, 79.68], [18.02, 79.82], [17.86, 79.80],
      [17.79, 79.62], [17.84, 79.48], [17.98, 79.44]
    ]
  },
  {
    id: 'bnd-dist-krm',
    name: 'Karimnagar District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Telangana',
    district: 'Karimnagar',
    coordinates: [
      [18.58, 78.96], [18.60, 79.22], [18.50, 79.34], [18.32, 79.32],
      [18.26, 79.12], [18.33, 78.96], [18.46, 78.93]
    ]
  },
  {
    id: 'bnd-dist-nzb',
    name: 'Nizamabad District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Telangana',
    district: 'Nizamabad',
    coordinates: [
      [18.88, 77.88], [18.90, 78.22], [18.74, 78.35], [18.54, 78.28],
      [18.49, 78.04], [18.58, 77.85], [18.74, 77.82]
    ]
  },
  {
    id: 'bnd-dist-blr',
    name: 'Bengaluru Urban District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    coordinates: [
      [13.09, 77.49], [13.09, 77.79], [12.84, 77.79], [12.84, 77.49]
    ]
  },
  {
    id: 'bnd-dist-chn',
    name: 'Chennai District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Chennai',
    coordinates: [
      [13.15, 80.17], [13.15, 80.31], [12.95, 80.31], [12.95, 80.17]
    ]
  },
  {
    id: 'bnd-dist-mum',
    name: 'Mumbai Suburban District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    coordinates: [
      [19.22, 72.80], [19.22, 72.95], [19.03, 72.95], [19.03, 72.80]
    ]
  },
  {
    id: 'bnd-dist-del',
    name: 'South East Delhi District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Delhi',
    district: 'South East Delhi',
    coordinates: [
      [28.59, 77.21], [28.59, 77.33], [28.49, 77.33], [28.49, 77.21]
    ]
  },
  {
    id: 'bnd-dist-viz',
    name: 'Visakhapatnam District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Andhra Pradesh',
    district: 'Visakhapatnam',
    coordinates: [
      [17.85, 83.20], [17.85, 83.40], [17.66, 83.40], [17.66, 83.20]
    ]
  },
  {
    id: 'bnd-dist-amd',
    name: 'Ahmedabad District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Gujarat',
    district: 'Ahmedabad',
    coordinates: [
      [23.11, 72.46], [23.11, 72.65], [22.96, 72.65], [22.96, 72.46]
    ]
  },
  {
    id: 'bnd-dist-koc',
    name: 'Ernakulam District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Kerala',
    district: 'Ernakulam',
    coordinates: [
      [10.08, 76.24], [10.08, 76.43], [9.92, 76.43], [9.92, 76.24]
    ]
  },
  {
    id: 'bnd-dist-bbi',
    name: 'Khordha District',
    level: 'DISTRICT',
    country: 'India',
    state: 'Odisha',
    district: 'Khordha',
    coordinates: [
      [20.41, 85.75], [20.41, 85.91], [20.22, 85.91], [20.22, 85.75]
    ]
  },
  {
    id: 'bnd-dist-ccu',
    name: 'North 24 Parganas District',
    level: 'DISTRICT',
    country: 'India',
    state: 'West Bengal',
    district: 'North 24 Parganas',
    coordinates: [
      [22.64, 88.36], [22.64, 88.50], [22.53, 88.50], [22.53, 88.36]
    ]
  },

  // =========================================================================
  // 3. CITY / TOWN BOUNDARIES
  // =========================================================================
  {
    id: 'bnd-city-hyd',
    name: 'Greater Hyderabad Metro',
    level: 'CITY',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    city: 'Hyderabad',
    coordinates: [
      [17.468, 78.338], [17.468, 78.405], [17.425, 78.405], [17.425, 78.338]
    ]
  },
  {
    id: 'bnd-city-blr',
    name: 'Bengaluru East Corridor',
    level: 'CITY',
    country: 'India',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    coordinates: [
      [12.990, 77.695], [12.990, 77.768], [12.950, 77.768], [12.950, 77.695]
    ]
  },
  {
    id: 'bnd-city-chn',
    name: 'Chennai South Metro',
    level: 'CITY',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
    coordinates: [
      [13.055, 80.205], [13.055, 80.250], [12.995, 80.250], [12.995, 80.205]
    ]
  },
  {
    id: 'bnd-city-mum',
    name: 'Mumbai BKC Financial Hub',
    level: 'CITY',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    city: 'Mumbai',
    coordinates: [
      [19.080, 72.852], [19.080, 72.878], [19.058, 72.878], [19.058, 72.852]
    ]
  },
  {
    id: 'bnd-city-del',
    name: 'New Delhi South-East Zone',
    level: 'CITY',
    country: 'India',
    state: 'Delhi',
    district: 'South East Delhi',
    city: 'New Delhi',
    coordinates: [
      [28.560, 77.240], [28.560, 77.285], [28.525, 77.285], [28.525, 77.240]
    ]
  },

  // =========================================================================
  // 4. LOCALITY / AREA BOUNDARIES
  // =========================================================================
  {
    id: 'bnd-loc-madhapur',
    name: 'Madhapur Locality',
    level: 'LOCALITY',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    city: 'Hyderabad',
    area: 'Madhapur',
    coordinates: [
      [17.4525, 78.3740], [17.4525, 78.3885], [17.4415, 78.3885], [17.4415, 78.3740]
    ]
  },
  {
    id: 'bnd-loc-gachibowli',
    name: 'Gachibowli Locality',
    level: 'LOCALITY',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    city: 'Hyderabad',
    area: 'Gachibowli',
    coordinates: [
      [17.4475, 78.3455], [17.4475, 78.3725], [17.4375, 78.3725], [17.4375, 78.3455]
    ]
  },
  {
    id: 'bnd-loc-whitefield',
    name: 'Whitefield–Brookefield Locality',
    level: 'LOCALITY',
    country: 'India',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    area: 'Whitefield',
    coordinates: [
      [12.9790, 77.7100], [12.9790, 77.7560], [12.9580, 77.7560], [12.9580, 77.7100]
    ]
  },
  {
    id: 'bnd-loc-guindy',
    name: 'Guindy Industrial Locality',
    level: 'LOCALITY',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
    area: 'Guindy',
    coordinates: [
      [13.0200, 80.2150], [13.0200, 80.2330], [13.0030, 80.2330], [13.0030, 80.2150]
    ]
  },
  {
    id: 'bnd-loc-bkc',
    name: 'Bandra Kurla Complex Locality',
    level: 'LOCALITY',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    city: 'Mumbai',
    area: 'Bandra Kurla Complex',
    coordinates: [
      [19.0730, 72.8590], [19.0730, 72.8710], [19.0620, 72.8710], [19.0620, 72.8590]
    ]
  },
  {
    id: 'bnd-loc-okhla',
    name: 'Okhla–Nehru Place Locality',
    level: 'LOCALITY',
    country: 'India',
    state: 'Delhi',
    district: 'South East Delhi',
    city: 'New Delhi',
    area: 'Okhla Phase II',
    coordinates: [
      [28.5520, 77.2480], [28.5520, 77.2750], [28.5320, 77.2750], [28.5320, 77.2480]
    ]
  },

  // =========================================================================
  // 5. UTILITY SERVICE AREAS (DISCOM Operating Zones)
  // =========================================================================
  {
    id: 'bnd-srv-tsspdcl',
    name: 'TSSPDCL Cyberabad Circle',
    level: 'SERVICE_AREA',
    country: 'India',
    state: 'Telangana',
    district: 'Hyderabad',
    utilityCode: 'TSSPDCL',
    coordinates: [
      [17.460, 78.340], [17.460, 78.392], [17.435, 78.392], [17.435, 78.340]
    ]
  },
  {
    id: 'bnd-srv-bescom',
    name: 'BESCOM Bengaluru East Division',
    level: 'SERVICE_AREA',
    country: 'India',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    utilityCode: 'BESCOM',
    coordinates: [
      [12.985, 77.705], [12.985, 77.762], [12.954, 77.762], [12.954, 77.705]
    ]
  },
  {
    id: 'bnd-srv-tangedco',
    name: 'TANGEDCO Chennai South EDC',
    level: 'SERVICE_AREA',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Chennai',
    utilityCode: 'TANGEDCO',
    coordinates: [
      [13.048, 80.212], [13.048, 80.242], [13.000, 80.242], [13.000, 80.212]
    ]
  },
  {
    id: 'bnd-srv-adani',
    name: 'Adani / BEST BKC Distribution Circle',
    level: 'SERVICE_AREA',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    utilityCode: 'BEST / AEML',
    coordinates: [
      [19.076, 72.856], [19.076, 72.874], [19.060, 72.874], [19.060, 72.856]
    ]
  },
  {
    id: 'bnd-srv-bses',
    name: 'BSES Rajdhani South East Circle',
    level: 'SERVICE_AREA',
    country: 'India',
    state: 'Delhi',
    district: 'South East Delhi',
    utilityCode: 'BRPL',
    coordinates: [
      [28.555, 77.245], [28.555, 77.278], [28.530, 77.278], [28.530, 77.245]
    ]
  }
];

const CURATED_DISTRICT_KEYS = new Set(
  CURATED_DISTRICT_AND_LOCAL_BOUNDARIES.filter((b) => b.level === 'DISTRICT' && b.district).map(
    (b) => `${b.state}::${b.district}`
  )
);

export const GEOGRAPHIC_BOUNDARIES: GeographicBoundary[] = [
  ...buildAllIndiaStateBoundaries(),
  ...CURATED_DISTRICT_AND_LOCAL_BOUNDARIES,
  ...buildAllIndiaDistrictBoundaries(CURATED_DISTRICT_KEYS)
];
