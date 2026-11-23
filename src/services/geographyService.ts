import type {
  ActiveFault,
  AuditLog,
  DataQualityIssue,
  EngineeringDecision,
  FieldEngineer,
  GeographicBoundary,
  GeographicFilterState,
  GeographicSearchResult,
  GridAlert,
  InfrastructureAsset,
  MaintenanceZone,
  OperationalEvent,
  PowerLine,
  SimulationScenario,
  SystemStats
} from '../types/grid.ts';
import { INDIA_STATES_REGISTRY } from './indiaGeographyRegistry.ts';

export const DEFAULT_GEO_FILTER: GeographicFilterState = {
  country: 'India',
  state: '',
  district: '',
  division: '',
  subdivision: '',
  city: '',
  area: '',
  substationId: '',
  feederId: '',
  transformerId: ''
};

export const INDIA_CENTER: [number, number] = [22.9734, 78.6569];
export const INDIA_ZOOM = 5;

export const INITIAL_MAP_CENTER: [number, number] = INDIA_CENTER;
export const INITIAL_MAP_ZOOM = INDIA_ZOOM;

const isMissingLabel = (val?: string | null): boolean => {
  if (!val) return true;
  const trimmed = val.trim();
  return (
    !trimmed ||
    trimmed === 'Unknown' ||
    trimmed === 'N/A' ||
    trimmed === 'Not available' ||
    trimmed === 'Not mapped'
  );
};

const normLabel = (val?: string | null): string => (val ?? '').trim().toLowerCase();

export function hasValidAssetCoordinates(
  asset: Pick<InfrastructureAsset, 'latitude' | 'longitude'>
): boolean {
  return (
    Number.isFinite(asset.latitude) &&
    Number.isFinite(asset.longitude) &&
    Math.abs(asset.latitude) <= 90 &&
    Math.abs(asset.longitude) <= 180 &&
    !(Math.abs(asset.latitude) < 1e-6 && Math.abs(asset.longitude) < 1e-6)
  );
}

/**
 * Ray-casting point-in-polygon check where polygon coordinates are [lat, lng].
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<[number, number]>
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0];
    const xi = polygon[i][1];
    const yj = polygon[j][0];
    const xj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isCoordinateInsideState(lat: number, lng: number, stateName: string): boolean {
  const target = normLabel(stateName);
  const entry = INDIA_STATES_REGISTRY.find((s) => normLabel(s.state) === target);
  if (!entry || entry.polygon.length < 3) return false;
  return isPointInPolygon(lat, lng, entry.polygon);
}

export function inferStateFromCoordinate(lat: number, lng: number): string | null {
  for (const entry of INDIA_STATES_REGISTRY) {
    if (entry.polygon.length >= 3 && isPointInPolygon(lat, lng, entry.polygon)) {
      return entry.state;
    }
  }
  return null;
}

const uniqueSorted = (values: Array<string | undefined>): string[] => {
  return Array.from(
    new Set(
      values
        .map((v) => v?.trim())
        .filter((v): v is string => Boolean(v && !isMissingLabel(v)))
    )
  ).sort((a, b) => a.localeCompare(b));
};

export function hasRegionalSelection(filter: GeographicFilterState): boolean {
  return Boolean(
    filter.state ||
      filter.district ||
      filter.division ||
      filter.subdivision ||
      filter.city ||
      filter.area ||
      filter.substationId ||
      filter.feederId ||
      filter.transformerId
  );
}

export function formatGeoBreadcrumb(filter: GeographicFilterState): string {
  const parts = [
    filter.country || 'India',
    filter.state,
    filter.district,
    filter.division,
    filter.subdivision,
    filter.city,
    filter.area,
    filter.substationId,
    filter.feederId,
    filter.transformerId
  ].filter((p) => Boolean(p && p.trim().length > 0));
  return parts.join(' › ');
}

export function filterAssetsByHierarchy(
  assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState>
): InfrastructureAsset[] {
  const targetCountry = filter.country ? normLabel(filter.country) : '';
  const targetState = filter.state ? normLabel(filter.state) : '';
  const targetDistrict = filter.district ? normLabel(filter.district) : '';
  const targetDivision = filter.division ? normLabel(filter.division) : '';
  const targetSubdivision = filter.subdivision ? normLabel(filter.subdivision) : '';
  const targetCity = filter.city ? normLabel(filter.city) : '';
  const targetArea = filter.area ? normLabel(filter.area) : '';

  return assets.filter((asset) => {
    if (!hasValidAssetCoordinates(asset)) {
      return false;
    }
    if (targetCountry) {
      if (isMissingLabel(asset.country) || normLabel(asset.country) !== targetCountry) {
        return false;
      }
    }
    if (targetState) {
      if (isMissingLabel(asset.state) || normLabel(asset.state) !== targetState) {
        return false;
      }
    }
    if (targetDistrict) {
      if (isMissingLabel(asset.district) || normLabel(asset.district) !== targetDistrict) {
        return false;
      }
    }
    if (targetDivision) {
      if (isMissingLabel(asset.division) || normLabel(asset.division) !== targetDivision) {
        return false;
      }
    }
    if (targetSubdivision) {
      if (isMissingLabel(asset.subdivision) || normLabel(asset.subdivision) !== targetSubdivision) {
        return false;
      }
    }
    if (targetCity) {
      if (isMissingLabel(asset.city) || normLabel(asset.city) !== targetCity) {
        return false;
      }
    }
    if (targetArea) {
      if (isMissingLabel(asset.area) || normLabel(asset.area) !== targetArea) {
        return false;
      }
    }
    if (
      filter.substationId &&
      asset.canonicalId !== filter.substationId &&
      asset.id !== filter.substationId &&
      asset.substationId !== filter.substationId
    ) {
      return false;
    }
    if (
      filter.feederId &&
      asset.canonicalId !== filter.feederId &&
      asset.id !== filter.feederId &&
      asset.feederId !== filter.feederId
    ) {
      return false;
    }
    if (
      filter.transformerId &&
      asset.canonicalId !== filter.transformerId &&
      asset.id !== filter.transformerId
    ) {
      return false;
    }
    return true;
  });
}

export interface ScopedAssetCounts {
  substations: number;
  feeders: number;
  transformers: number;
  breakersAndSwitches: number;
  towersAndPoles: number;
  generators: number;
  electricalEquipment: number;
  totalAssets: number;
}

export interface ScopedMapDisplay {
  displayAssets: InfrastructureAsset[];
  displayPowerLines: PowerLine[];
  counts: ScopedAssetCounts;
}

/**
 * Single source of truth for both Map markers/lines and Inspector/Details panel counts.
 * Guarantees 1:1 count parity between map markers and details panel numbers.
 */
export function computeScopedMapDisplay(
  scopedAssets: InfrastructureAsset[],
  scopedPowerLines: PowerLine[]
): ScopedMapDisplay {
  const dedupedAssetsMap = new Map<string, InfrastructureAsset>();
  for (const asset of scopedAssets) {
    if (!hasValidAssetCoordinates(asset)) continue;
    dedupedAssetsMap.set(asset.canonicalId || asset.id, asset);
  }
  const displayAssets = Array.from(dedupedAssetsMap.values());

  const assetIds = new Set(displayAssets.map((a) => a.canonicalId || a.id));
  const dedupedLinesMap = new Map<string, PowerLine>();
  for (const line of scopedPowerLines) {
    const key = line.canonicalId || line.id;
    if (
      assetIds.has(key) ||
      assetIds.has(line.feederId) ||
      (line.substationId && assetIds.has(line.substationId))
    ) {
      dedupedLinesMap.set(key, line);
    }
  }
  const displayPowerLines = Array.from(dedupedLinesMap.values());

  const substations = displayAssets.filter(
    (a) => a.assetType === 'SUBSTATION' || a.assetType === 'PLANT'
  ).length;

  const feederIds = new Set<string>();
  for (const a of displayAssets) {
    if (a.assetType === 'FEEDER') feederIds.add(a.canonicalId || a.id);
  }
  for (const l of displayPowerLines) {
    feederIds.add(l.canonicalId || l.id);
  }

  const transformers = displayAssets.filter((a) => a.assetType === 'TRANSFORMER').length;
  const breakersAndSwitches = displayAssets.filter(
    (a) =>
      a.assetType === 'CIRCUIT_BREAKER' ||
      a.assetType === 'SECTIONALIZER' ||
      a.assetType === 'RECLOSER' ||
      a.osmType === 'switch'
  ).length;
  const towersAndPoles = displayAssets.filter(
    (a) => a.assetType === 'TOWER' || a.assetType === 'POLE'
  ).length;
  const generators = displayAssets.filter((a) => a.assetType === 'GENERATOR').length;
  const electricalEquipment = displayAssets.filter(
    (a) => a.assetType === 'ELECTRICAL_EQUIPMENT' || a.assetType === 'LOAD_POINT'
  ).length;

  return {
    displayAssets,
    displayPowerLines,
    counts: {
      substations,
      feeders: feederIds.size,
      transformers,
      breakersAndSwitches,
      towersAndPoles,
      generators,
      electricalEquipment,
      totalAssets: displayAssets.length
    }
  };
}

export function getCountries(_assets: InfrastructureAsset[]): string[] {
  return ['India'];
}

export function getStates(
  _assets: InfrastructureAsset[],
  _filter: Partial<GeographicFilterState> = {}
): string[] {
  return INDIA_STATES_REGISTRY.map((s) => s.state).sort((a, b) => a.localeCompare(b));
}

export function getDistricts(
  _assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState> = {}
): string[] {
  if (!filter.state) return [];
  const targetState = normLabel(filter.state);
  const stateEntry = INDIA_STATES_REGISTRY.find((s) => normLabel(s.state) === targetState);
  if (!stateEntry) return [];
  return stateEntry.districts.map((d) => d.name).sort((a, b) => a.localeCompare(b));
}

export function getDivisions(
  assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState> = {}
): string[] {
  const scoped = filterAssetsByHierarchy(assets, { ...filter, division: '' });
  return uniqueSorted(scoped.map((a) => a.division));
}

export function getSubdivisions(
  assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState> = {}
): string[] {
  const scoped = filterAssetsByHierarchy(assets, { ...filter, subdivision: '' });
  return uniqueSorted(scoped.map((a) => a.subdivision));
}

export function getCities(
  assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState> = {}
): string[] {
  const scoped = filterAssetsByHierarchy(assets, { ...filter, city: '' });
  return uniqueSorted(scoped.map((a) => a.city));
}

export function getAreas(
  assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState> = {}
): string[] {
  const scoped = filterAssetsByHierarchy(assets, { ...filter, area: '' });
  return uniqueSorted(scoped.map((a) => a.area));
}

export function getSubstations(
  assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState> = {}
): Array<{ id: string; label: string }> {
  const scoped = filterAssetsByHierarchy(assets, {
    ...filter,
    substationId: '',
    feederId: '',
    transformerId: ''
  });
  return scoped
    .filter((a) => a.assetType === 'SUBSTATION' || a.assetType === 'PLANT')
    .map((a) => ({
      id: a.canonicalId,
      label: `${!isMissingLabel(a.name) ? a.name : a.osmType} (${a.canonicalId})`
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getFeeders(
  assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState> = {}
): Array<{ id: string; label: string }> {
  const scoped = filterAssetsByHierarchy(assets, {
    ...filter,
    feederId: '',
    transformerId: ''
  });
  return scoped
    .filter((a) => a.assetType === 'FEEDER')
    .map((a) => ({
      id: a.canonicalId,
      label: `${!isMissingLabel(a.name) ? a.name : a.osmType} (${a.canonicalId})`
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getTransformers(
  assets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState> = {}
): Array<{ id: string; label: string }> {
  const scoped = filterAssetsByHierarchy(assets, {
    ...filter,
    transformerId: ''
  });
  return scoped
    .filter((a) => a.assetType === 'TRANSFORMER')
    .map((a) => ({
      id: a.canonicalId,
      label: `${!isMissingLabel(a.name) ? a.name : 'Transformer'} (${a.canonicalId})`
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function filterBoundaries(
  boundaries: GeographicBoundary[],
  filter: Partial<GeographicFilterState>
): GeographicBoundary[] {
  const targetCountry = filter.country ? normLabel(filter.country) : '';
  const targetState = filter.state ? normLabel(filter.state) : '';
  const targetDistrict = filter.district ? normLabel(filter.district) : '';
  const targetCity = filter.city ? normLabel(filter.city) : '';
  const targetArea = filter.area ? normLabel(filter.area) : '';

  return boundaries.filter((b) => {
    if (targetCountry && normLabel(b.country) !== targetCountry) return false;
    if (b.level === 'STATE') {
      return !targetState || normLabel(b.state) === targetState;
    }
    if (!targetState) return false;
    if (normLabel(b.state) !== targetState) return false;
    if (b.level === 'DISTRICT') {
      return !targetDistrict || (Boolean(b.district) && normLabel(b.district) === targetDistrict);
    }
    if (b.level === 'CITY') {
      if (targetDistrict && b.district && normLabel(b.district) !== targetDistrict) return false;
      if (targetCity && b.city && normLabel(b.city) !== targetCity) return false;
      return true;
    }
    if (b.level === 'LOCALITY') {
      if (targetDistrict && b.district && normLabel(b.district) !== targetDistrict) return false;
      if (targetCity && b.city && normLabel(b.city) !== targetCity) return false;
      if (targetArea && b.area && normLabel(b.area) !== targetArea) return false;
      return true;
    }
    if (b.level === 'SERVICE_AREA') {
      if (targetDistrict && b.district && normLabel(b.district) !== targetDistrict) return false;
      return true;
    }
    return true;
  });
}

function averageCoords(coords: Array<[number, number]>): [number, number] {
  if (coords.length === 0) return INITIAL_MAP_CENTER;
  const lat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const lng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
  return [lat, lng];
}

/**
 * Computes Mapbox LngLatBoundsLike [[west, south], [east, north]] for the active geographic filter.
 * Returns null for national view (no region selection) or direct asset selection (uses asset flyTo).
 */
export function computeBoundsForSelection(
  assets: InfrastructureAsset[],
  boundaries: GeographicBoundary[],
  filter: GeographicFilterState
): [[number, number], [number, number]] | null {
  if (!hasRegionalSelection(filter)) return null;
  if (filter.transformerId || filter.feederId || filter.substationId) return null;

  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  let count = 0;

  const includeLatLng = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    count += 1;
  };

  const targetState = normLabel(filter.state);
  const targetDistrict = normLabel(filter.district);
  const targetCity = normLabel(filter.city);
  const targetArea = normLabel(filter.area);

  if (targetArea) {
    const areaBoundaries = boundaries.filter(
      (b) =>
        b.level === 'LOCALITY' &&
        (!targetState || normLabel(b.state) === targetState) &&
        normLabel(b.area) === targetArea
    );
    for (const b of areaBoundaries) {
      for (const [lat, lng] of b.coordinates) includeLatLng(lat, lng);
    }
    if (count === 0) {
      for (const a of assets) {
        if (normLabel(a.area) === targetArea && hasValidAssetCoordinates(a)) {
          includeLatLng(a.latitude, a.longitude);
        }
      }
    }
  } else if (targetCity) {
    const cityBoundaries = boundaries.filter(
      (b) =>
        b.level === 'CITY' &&
        (!targetState || normLabel(b.state) === targetState) &&
        normLabel(b.city) === targetCity
    );
    for (const b of cityBoundaries) {
      for (const [lat, lng] of b.coordinates) includeLatLng(lat, lng);
    }
    if (count === 0) {
      for (const a of assets) {
        if (normLabel(a.city) === targetCity && hasValidAssetCoordinates(a)) {
          includeLatLng(a.latitude, a.longitude);
        }
      }
    }
  } else if (targetDistrict) {
    const distBoundaries = boundaries.filter(
      (b) =>
        b.level === 'DISTRICT' &&
        (!targetState || normLabel(b.state) === targetState) &&
        normLabel(b.district) === targetDistrict
    );
    for (const b of distBoundaries) {
      for (const [lat, lng] of b.coordinates) includeLatLng(lat, lng);
    }
    for (const a of assets) {
      if (normLabel(a.district) === targetDistrict && hasValidAssetCoordinates(a)) {
        includeLatLng(a.latitude, a.longitude);
      }
    }
    if (count === 0) {
      const stateEntry = INDIA_STATES_REGISTRY.find(
        (s) => !targetState || normLabel(s.state) === targetState
      );
      const dist = stateEntry?.districts.find((d) => normLabel(d.name) === targetDistrict);
      if (dist) {
        includeLatLng(dist.lat - 0.09, dist.lng - 0.1);
        includeLatLng(dist.lat + 0.09, dist.lng + 0.1);
      }
    }
  } else if (targetState) {
    const stateBoundaries = boundaries.filter(
      (b) => b.level === 'STATE' && normLabel(b.state) === targetState
    );
    for (const b of stateBoundaries) {
      for (const [lat, lng] of b.coordinates) includeLatLng(lat, lng);
    }
    if (count === 0) {
      const stateEntry = INDIA_STATES_REGISTRY.find((s) => normLabel(s.state) === targetState);
      if (stateEntry) {
        for (const [lat, lng] of stateEntry.polygon) includeLatLng(lat, lng);
      }
    }
  }

  if (count === 0) return null;

  // Ensure non-degenerate bounds when a single asset point is present
  if (Math.abs(maxLat - minLat) < 0.01) {
    minLat -= 0.012;
    maxLat += 0.012;
  }
  if (Math.abs(maxLng - minLng) < 0.01) {
    minLng -= 0.015;
    maxLng += 0.015;
  }

  return [
    [Number(minLng.toFixed(5)), Number(minLat.toFixed(5))],
    [Number(maxLng.toFixed(5)), Number(maxLat.toFixed(5))]
  ];
}

export function computeViewportForSelection(
  assets: InfrastructureAsset[],
  boundaries: GeographicBoundary[],
  filter: GeographicFilterState
): { center: [number, number]; zoom: number } {
  if (!hasRegionalSelection(filter)) {
    return { center: INDIA_CENTER, zoom: INDIA_ZOOM };
  }

  if (filter.transformerId) {
    const target = assets.find((a) => a.canonicalId === filter.transformerId || a.id === filter.transformerId);
    if (target) return { center: [target.latitude, target.longitude], zoom: 17 };
  }
  if (filter.feederId) {
    const target = assets.find((a) => a.canonicalId === filter.feederId || a.id === filter.feederId);
    if (target) return { center: [target.latitude, target.longitude], zoom: 15 };
  }
  if (filter.substationId) {
    const sub = assets.find((a) => a.canonicalId === filter.substationId || a.id === filter.substationId);
    if (sub) return { center: [sub.latitude, sub.longitude], zoom: 15 };
  }

  const bounds = computeBoundsForSelection(assets, boundaries, filter);
  if (bounds) {
    const [[west, south], [east, north]] = bounds;
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;
    const zoom = filter.area ? 13 : filter.city ? 12 : filter.district ? 11 : 7.5;
    return { center: [centerLat, centerLng], zoom };
  }

  if (filter.district) {
    const stateEntry = INDIA_STATES_REGISTRY.find((s) => !filter.state || normLabel(s.state) === normLabel(filter.state));
    const dist = stateEntry?.districts.find((d) => normLabel(d.name) === normLabel(filter.district));
    if (dist) {
      return { center: [dist.lat, dist.lng], zoom: 11 };
    }
    const distBnd = boundaries.find(
      (b) => b.level === 'DISTRICT' && normLabel(b.district) === normLabel(filter.district)
    );
    if (distBnd) return { center: averageCoords(distBnd.coordinates), zoom: 11 };
  }

  if (filter.state) {
    const stateEntry = INDIA_STATES_REGISTRY.find((s) => normLabel(s.state) === normLabel(filter.state));
    if (stateEntry) {
      return {
        center: stateEntry.center,
        zoom: stateEntry.defaultZoom
      };
    }
    const stateBnd = boundaries.find(
      (b) => b.level === 'STATE' && normLabel(b.state) === normLabel(filter.state)
    );
    if (stateBnd) return { center: averageCoords(stateBnd.coordinates), zoom: 7.5 };
  }

  return { center: INITIAL_MAP_CENTER, zoom: INITIAL_MAP_ZOOM };
}

export function searchGeographyAndAssets(
  assets: InfrastructureAsset[],
  _boundaries: GeographicBoundary[],
  query: string
): GeographicSearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const exactLocationResults: GeographicSearchResult[] = [];
  const partialLocationResults: GeographicSearchResult[] = [];

  for (const entry of INDIA_STATES_REGISTRY) {
    const stateLower = entry.state.toLowerCase();
    if (stateLower.includes(q)) {
      const stateMatchCount = assets.filter((a) => normLabel(a.state) === stateLower).length;
      const item: GeographicSearchResult = {
        kind: 'LOCATION',
        id: `loc-state-${entry.state}`,
        label: entry.state,
        sublabel: `${entry.isUT ? 'Union Territory' : 'State'} · India (${entry.districts.length} Districts${stateMatchCount > 0 ? ` · ${stateMatchCount} Mapped Assets` : ''})`,
        filterPatch: {
          country: 'India',
          state: entry.state,
          district: '',
          division: '',
          subdivision: '',
          city: '',
          area: '',
          substationId: '',
          feederId: '',
          transformerId: ''
        },
        latitude: entry.center[0],
        longitude: entry.center[1],
        zoom: Math.max(entry.defaultZoom, 7.5)
      };
      if (stateLower === q || stateLower.startsWith(q)) {
        exactLocationResults.push(item);
      } else {
        partialLocationResults.push(item);
      }
    }

    for (const dist of entry.districts) {
      const distLower = dist.name.toLowerCase();
      if (distLower.includes(q)) {
        const distAssetCount = assets.filter(
          (a) => normLabel(a.state) === stateLower && normLabel(a.district) === distLower
        ).length;
        const item: GeographicSearchResult = {
          kind: 'LOCATION',
          id: `loc-dist-${entry.state}-${dist.name}`,
          label: `${dist.name} District`,
          sublabel: `${entry.state} · India${distAssetCount > 0 ? ` · ${distAssetCount} Grid Assets` : ''}`,
          filterPatch: {
            country: 'India',
            state: entry.state,
            district: dist.name,
            division: '',
            subdivision: '',
            city: '',
            area: '',
            substationId: '',
            feederId: '',
            transformerId: ''
          },
          latitude: dist.lat,
          longitude: dist.lng,
          zoom: 11
        };
        if (distLower === q) {
          exactLocationResults.unshift(item);
        } else if (distLower.startsWith(q)) {
          exactLocationResults.push(item);
        } else {
          partialLocationResults.push(item);
        }
      }
    }
  }

  const assetResults: GeographicSearchResult[] = [];
  for (const asset of assets) {
    if (!hasValidAssetCoordinates(asset)) continue;
    const matches =
      asset.canonicalId.toLowerCase().includes(q) ||
      asset.id.toLowerCase().includes(q) ||
      asset.name.toLowerCase().includes(q) ||
      (asset.rawName && asset.rawName.toLowerCase().includes(q)) ||
      asset.assetType.toLowerCase().includes(q) ||
      asset.osmType.toLowerCase().includes(q) ||
      (asset.operator && asset.operator.toLowerCase().includes(q)) ||
      (asset.voltage && asset.voltage.toLowerCase().includes(q)) ||
      (asset.pincode && asset.pincode.toLowerCase().includes(q)) ||
      (asset.landmarks && asset.landmarks.toLowerCase().includes(q)) ||
      (asset.streetAddress && asset.streetAddress.toLowerCase().includes(q)) ||
      (!isMissingLabel(asset.area) && asset.area.toLowerCase().includes(q)) ||
      (!isMissingLabel(asset.city) && asset.city.toLowerCase().includes(q)) ||
      (!isMissingLabel(asset.district) && asset.district.toLowerCase().includes(q)) ||
      (!isMissingLabel(asset.state) && asset.state.toLowerCase().includes(q));

    if (matches) {
      const locationText = [asset.area, asset.city, asset.district, asset.state]
        .filter((v) => !isMissingLabel(v))
        .join(', ');

      assetResults.push({
        kind: 'ASSET',
        id: `asset-${asset.canonicalId}`,
        label: `${!isMissingLabel(asset.rawName ?? asset.name) ? (asset.rawName ?? asset.name) : asset.assetType} — ${asset.canonicalId}`,
        sublabel: `[${asset.source}] ${asset.assetType} · ${asset.voltage ?? 'Voltage: Not available'} · ${
          asset.operator ?? 'Operator: Not available'
        }${locationText ? ` · ${locationText}` : ''}`,
        asset,
        filterPatch: {
          country: 'India',
          state: !isMissingLabel(asset.state) ? asset.state : '',
          district: !isMissingLabel(asset.district) ? asset.district : ''
        },
        latitude: asset.latitude,
        longitude: asset.longitude,
        zoom: 16
      });
      if (assetResults.length >= 12) break;
    }
  }

  const locationResults = [...exactLocationResults, ...partialLocationResults];
  const hasExactLocation = exactLocationResults.some(
    (loc) =>
      loc.label.toLowerCase() === q ||
      loc.label.toLowerCase() === `${q} district`
  );

  if (hasExactLocation) {
    return [...locationResults.slice(0, 5), ...assetResults.slice(0, 10)].slice(0, 15);
  }
  return [...assetResults.slice(0, 10), ...locationResults.slice(0, 5)].slice(0, 15);
}

export function filterFieldEngineersByHierarchy(
  engineers: FieldEngineer[],
  scopedAssets: InfrastructureAsset[],
  filter: Partial<GeographicFilterState>
): FieldEngineer[] {
  if (!filter.state && !filter.district && !filter.city && !filter.area && !filter.substationId && !filter.feederId && !filter.transformerId) {
    return engineers;
  }
  const targetState = filter.state ? normLabel(filter.state) : '';
  const targetDistrict = filter.district ? normLabel(filter.district) : '';
  const scopedAssetIds = new Set(scopedAssets.map((a) => a.canonicalId));

  return engineers.filter((eng) => {
    if (eng.currentAssetId && scopedAssetIds.has(eng.currentAssetId)) return true;
    if (targetState && normLabel(eng.state) !== targetState) return false;
    if (targetDistrict && normLabel(eng.district) !== targetDistrict) return false;
    if (
      (filter.area || filter.substationId || filter.feederId || filter.transformerId) &&
      scopedAssets.length > 0 &&
      eng.currentAssetId &&
      !scopedAssetIds.has(eng.currentAssetId)
    ) {
      return false;
    }
    return true;
  });
}

export function filterAlertsByHierarchy(
  alerts: GridAlert[],
  scopedAssets: InfrastructureAsset[],
  scopedFaults: ActiveFault[],
  filter: Partial<GeographicFilterState>
): GridAlert[] {
  if (
    !filter.state &&
    !filter.district &&
    !filter.city &&
    !filter.area &&
    !filter.substationId &&
    !filter.feederId &&
    !filter.transformerId
  ) {
    return alerts;
  }
  const assetIds = new Set(scopedAssets.map((a) => a.canonicalId));
  const faultAssetIds = new Set(scopedFaults.map((f) => f.affectedAssetId));
  const faultIds = new Set(scopedFaults.map((f) => f.id));
  const targetState = filter.state ? normLabel(filter.state) : '';
  const targetDistrict = filter.district ? normLabel(filter.district) : '';

  return alerts.filter((alert) => {
    if (assetIds.has(alert.assetId)) return true;
    if (faultAssetIds.has(alert.assetId) || faultIds.has(alert.id)) return true;
    const loc = normLabel(alert.locationLabel);
    if (targetDistrict && loc.includes(targetDistrict)) return true;
    if (!targetDistrict && targetState && loc.includes(targetState)) return true;
    return false;
  });
}

export interface ScopedPlatformData {
  scopedAssets: InfrastructureAsset[];
  scopedFaults: ActiveFault[];
  scopedMaintenanceZones: MaintenanceZone[];
  scopedPowerLines: PowerLine[];
  scopedBoundaries: GeographicBoundary[];
  scopedIssues: DataQualityIssue[];
  scopedEvents: OperationalEvent[];
  scopedScenarios: SimulationScenario[];
  scopedDecisions: EngineeringDecision[];
  scopedAuditLogs: AuditLog[];
  scopedStats: SystemStats;
  scopedDisplay: ScopedMapDisplay;
}

export function scopePlatformData(params: {
  filter: GeographicFilterState;
  assets: InfrastructureAsset[];
  faults: ActiveFault[];
  maintenanceZones: MaintenanceZone[];
  powerLines: PowerLine[];
  boundaries: GeographicBoundary[];
  issues: DataQualityIssue[];
  events: OperationalEvent[];
  scenarios: SimulationScenario[];
  decisions: EngineeringDecision[];
  auditLogs: AuditLog[];
  baseStats: SystemStats;
}): ScopedPlatformData {
  const {
    filter,
    assets,
    faults,
    maintenanceZones,
    powerLines,
    boundaries,
    issues,
    events,
    scenarios,
    decisions,
    auditLogs
  } = params;

  const hasRegion = hasRegionalSelection(filter);
  const scopedAssets = filterAssetsByHierarchy(assets, filter);
  const scopedBoundaries = filterBoundaries(boundaries, filter);
  const assetIds = new Set(scopedAssets.map((a) => a.canonicalId || a.id));

  const scopedFaults = !hasRegion
    ? faults
    : faults.filter(
        (f) =>
          assetIds.has(f.affectedAssetId) ||
          (f.affectedFeederId && assetIds.has(f.affectedFeederId)) ||
          (f.affectedSubstationId && assetIds.has(f.affectedSubstationId))
      );

  const scopedPowerLines =
    !hasRegion && !filter.feederId
      ? powerLines
      : powerLines.filter((l) => {
          if (filter.feederId && l.canonicalId !== filter.feederId && l.feederId !== filter.feederId) {
            return false;
          }
          return (
            assetIds.has(l.canonicalId) ||
            assetIds.has(l.feederId) ||
            (l.substationId && assetIds.has(l.substationId))
          );
        });

  const scopedMaintenanceZones = !hasRegion
    ? maintenanceZones
    : maintenanceZones.filter((z) => assetIds.has(z.feederId));

  const scopedIssues = !hasRegion
    ? issues
    : issues.filter((i) => assetIds.has(i.canonicalAssetId));

  const scopedEvents = !hasRegion
    ? events
    : events.filter((e) => assetIds.has(e.assetCanonicalId));

  const targetState = normLabel(filter.state);
  const targetDistrict = normLabel(filter.district);

  const scopedDecisions = !hasRegion
    ? decisions
    : decisions.filter((d) => {
        if (assetIds.has(d.targetAssetId)) return true;
        if (targetDistrict && d.district && normLabel(d.district) === targetDistrict) return true;
        if (!targetDistrict && targetState && d.state && normLabel(d.state) === targetState) {
          return !filter.area && !filter.substationId && !filter.feederId && !filter.transformerId;
        }
        return false;
      });

  const scopedScenarios = !hasRegion
    ? scenarios
    : scenarios.filter(
        (s) =>
          (s.substationId && assetIds.has(s.substationId)) ||
          assetIds.has(s.sourceFeederId) ||
          assetIds.has(s.targetFeederId) ||
          (s.transformerId && assetIds.has(s.transformerId))
      );

  const scopedDisplay = computeScopedMapDisplay(scopedAssets, scopedPowerLines);

  const unresolvedConflicts = scopedIssues.filter((i) => i.status !== 'RESOLVED').length;
  const activeFaultCount = scopedFaults.filter((f) => f.status !== 'RESTORED').length;
  const pendingApprovals = scopedDecisions.filter(
    (d) => d.status === 'SUBMITTED' || d.status === 'PENDING_REVIEW' || d.status === 'UNDER_REVIEW'
  ).length;

  const dataQualityScore =
    scopedAssets.length === 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(((scopedAssets.length - unresolvedConflicts) / scopedAssets.length) * 1000) / 10
          )
        );

  return {
    scopedAssets,
    scopedFaults,
    scopedMaintenanceZones,
    scopedPowerLines,
    scopedBoundaries,
    scopedIssues,
    scopedEvents,
    scopedScenarios,
    scopedDecisions,
    scopedAuditLogs: auditLogs,
    scopedDisplay,
    scopedStats: {
      totalAssets: scopedAssets.length,
      dataQualityScore,
      activeConflictsCount: unresolvedConflicts + activeFaultCount,
      reconstructedEventsCount: scopedEvents.length,
      activeScenariosCount: scopedScenarios.length,
      pendingApprovalsCount: pendingApprovals,
      orphanedAssetsCount: 0
    }
  };
}

