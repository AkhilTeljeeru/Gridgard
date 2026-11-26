import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapGL, {
  AttributionControl,
  FullscreenControl,
  Layer,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
  type MapMouseEvent,
  type MapRef
} from 'react-map-gl/mapbox';
import type { GeoJSONSource, StyleSpecification } from 'mapbox-gl';
import { useGrid, type MapBoundingBox } from '../../context/GridContext';
import type {
  ActiveFault,
  AssetTelemetryStatus,
  FieldEngineer,
  FieldEngineerStatus,
  GeographicBoundary,
  InfrastructureAsset,
  MaintenanceZone,
  PowerLine,
  SimulationMapOverlay
} from '../../types/grid';
import { formatMissingValue } from '../../services/syntheticData';
import { SourceBadge } from '../ui/SourceBadge';

export type BasemapMode = 'dark' | 'streets' | 'satellite';

interface RenderedMapFeature {
  layer?: { id?: string };
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string; coordinates?: unknown };
}

type ActiveOverlayPopup =
  | { kind: 'asset'; id: string; lng: number; lat: number }
  | { kind: 'fault'; id: string; lng: number; lat: number }
  | { kind: 'line'; line: PowerLine; lng: number; lat: number }
  | { kind: 'conflict'; asset: InfrastructureAsset; lng: number; lat: number }
  | { kind: 'maintenance'; zone: MaintenanceZone; lng: number; lat: number }
  | { kind: 'boundary'; boundary: GeographicBoundary; lng: number; lat: number }
  | { kind: 'engineer'; engineerId: string; lng: number; lat: number }
  | null;

export interface ReconstructionMapOverlay {
  eventId: string;
  title: string;
  affectedAssetIds: string[];
  affectedFeederId: string | null;
  affectedAreaPolygon: [number, number][];
  activeStepAssetId: string | null;
  assetStatuses: Record<string, 'ACTIVE' | 'WARNING' | 'FAULTED'>;
  isPlaying: boolean;
  reducedMotion: boolean;
  fitBoundsNonce?: number;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const HAS_MAPBOX_TOKEN = Boolean(
  MAPBOX_TOKEN &&
    MAPBOX_TOKEN.trim().length > 0 &&
    MAPBOX_TOKEN.trim() !== 'YOUR_MAPBOX_PUBLIC_ACCESS_TOKEN'
);

const MAPBOX_STYLES: Record<BasemapMode, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
};

const OSM_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: 'OSM Fallback Raster',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

function formatUtcTimestamp(iso?: string | null): string {
  if (!iso) return 'Not available';
  return `${iso.replace('T', ' ').slice(0, 19)} UTC`;
}

function getAssetBadgeCode(asset: InfrastructureAsset): string {
  switch (asset.assetType) {
    case 'SUBSTATION':
      return 'SUB';
    case 'PLANT':
      return 'PLT';
    case 'GENERATOR':
      return 'GEN';
    case 'FEEDER':
      return 'FDR';
    case 'TRANSFORMER':
      return 'DTR';
    case 'CIRCUIT_BREAKER':
      return 'CB';
    case 'SECTIONALIZER':
    case 'RECLOSER':
      return 'SW';
    case 'ELECTRICAL_EQUIPMENT':
    case 'LOAD_POINT':
      return 'EQP';
    case 'TOWER':
      return 'TWR';
    case 'POLE':
      return 'POL';
    default:
      return 'AST';
  }
}

function resolveEffectiveStatus(
  asset: InfrastructureAsset,
  telemetry?: AssetTelemetryStatus,
  statusOverride?: 'ACTIVE' | 'WARNING' | 'FAULTED'
): string {
  if (statusOverride) return statusOverride;
  if (telemetry) {
    if (telemetry.status === 'FAULT') return 'FAULTED';
    if (telemetry.status === 'WARNING') return 'WARNING';
    return 'ACTIVE';
  }
  return asset.status;
}

/**
 * Phase 2 standardized Mapbox asset colors:
 * Substation (#2563EB Blue), Feeder (#10B981 Green), Transformer (#F97316 Orange),
 * Circuit Breaker / Switch (#9333EA Purple), Active Fault (#EF4444 Red),
 * Maintenance (#EAB308 Yellow), Offline / Unknown (#64748B Gray)
 */
function getAssetPinColor(
  asset: InfrastructureAsset,
  effectiveStatus: string,
  isReconstruction: boolean
): string {
  if (isReconstruction) {
    if (effectiveStatus === 'FAULTED') return '#EF4444';
    if (effectiveStatus === 'WARNING') return '#F59E0B';
    return '#10B981';
  }

  if (effectiveStatus === 'FAULTED') return '#EF4444';
  if (effectiveStatus === 'MAINTENANCE') return '#EAB308';
  if (effectiveStatus === 'DE_ENERGIZED') return '#64748B';

  switch (asset.assetType) {
    case 'SUBSTATION':
    case 'PLANT':
    case 'GENERATOR':
      return '#2563EB';
    case 'FEEDER':
      return '#10B981';
    case 'TRANSFORMER':
      return '#F97316';
    case 'CIRCUIT_BREAKER':
    case 'SECTIONALIZER':
    case 'RECLOSER':
      return '#9333EA';
    default:
      return effectiveStatus === 'UNKNOWN' ? '#64748B' : '#0EA5E9';
  }
}

function getBoundaryStyle(level: GeographicBoundary['level'], hasRegionSelection: boolean) {
  switch (level) {
    case 'STATE':
      return { color: '#0284C7', fillColor: '#0EA5E9', fillOpacity: hasRegionSelection ? 0.03 : 0.07 };
    case 'DISTRICT':
      return { color: '#6366F1', fillColor: '#818CF8', fillOpacity: 0.05 };
    case 'CITY':
      return { color: '#0D9488', fillColor: '#14B8A6', fillOpacity: 0.06 };
    case 'LOCALITY':
      return { color: '#059669', fillColor: '#10B981', fillOpacity: 0.08 };
    case 'SERVICE_AREA':
      return { color: '#8B5CF6', fillColor: '#A78BFA', fillOpacity: 0.05 };
  }
}

function buildClosedLngLatRing(coords: [number, number][]): [number, number][] {
  if (coords.length < 3) return [];
  const ring = coords.map(([lat, lng]) => [lng, lat] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function createCirclePolygonRing(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  steps = 36
): [number, number][] {
  const coords: [number, number][] = [];
  const earthRadius = 6378137;
  const latRad = (centerLat * Math.PI) / 180;
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = ((radiusMeters * Math.cos(angle)) / earthRadius) * (180 / Math.PI);
    const dLng =
      ((radiusMeters * Math.sin(angle)) / (earthRadius * Math.cos(latRad))) * (180 / Math.PI);
    coords.push([centerLng + dLng, centerLat + dLat]);
  }
  return coords;
}

function getEngineerMarkerBg(status: FieldEngineerStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return '#10B981'; // green
    case 'TRAVELING':
      return '#2563EB'; // blue
    case 'WORKING':
      return '#F97316'; // orange
    case 'ON_BREAK':
      return '#EAB308'; // yellow
    default:
      return '#64748B'; // gray
  }
}

export const GridMapComponent: React.FC<{
  heightClass?: string;
  readOnly?: boolean;
  reconstruction?: ReconstructionMapOverlay;
  simulationOverlay?: SimulationMapOverlay | null;
  onOpenFullMap?: () => void;
  showOverviewSubstationsWhenUnselected?: boolean;
  showFieldWorkforce?: boolean;
  focusEngineerNonce?: number;
  flyToRequest?: { lat: number; lng: number; zoom?: number; nonce: number } | null;
  onSelectEngineer?: (engineer: FieldEngineer) => void;
  onSelectAsset?: (asset: InfrastructureAsset) => void;
  onSelectFault?: (fault: ActiveFault) => void;
}> = ({
  heightClass = 'h-[600px]',
  readOnly = false,
  reconstruction,
  simulationOverlay,
  onOpenFullMap,
  showFieldWorkforce = true,
  focusEngineerNonce = 0,
  flyToRequest = null,
  onSelectEngineer,
  onSelectAsset,
  onSelectFault
}) => {
  const {
    isDark,
    assets: allAssets,
    powerLines: allPowerLines,
    faults: allFaults,
    scopedDisplayAssets,
    scopedDisplayPowerLines,
    scopedFaults,
    scopedMaintenanceZones,
    scopedBoundaries,
    hasRegionSelection,
    selectedAssetId,
    hoveredAssetId,
    focusRequest,
    connectedPath,
    selectedFaultId,
    faultFocusNonce,
    highlightedAssetIds,
    activeSimulationOverlay,
    mapCenter,
    mapZoom,
    currentMapZoom,
    mapLayers,
    osmLoading,
    osmError,
    osmCached,
    telemetryByAssetId,
    telemetrySourceType,
    selectAsset,
    setHoveredAsset,
    clearSelection,
    setSelectedFaultId,
    fetchOsmAssetsForBounds,
    updateGeoFilterLevel,
    openEventReconstructionForAsset,
    openEventReconstructionForFault,
    openKnowledgeGraphForAsset,
    launchSimulationForAsset,
    inspectMaintenanceHistory,
    openFieldTaskForAsset,
    setActiveView,
    aiSnapshot,
    getAssetHealth,
    getAssetLifecycle,
    recentAnimatedAssetIds,
    fieldEngineers,
    selectedEngineerId,
    setSelectedEngineerId,
    engineerRoutes,
    geoFences,
    fieldTasks,
    openKnowledgeGraphForEngineer,
    simulateEngineerStepTowardTarget
  } = useGrid();

  const mapRef = useRef<MapRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const lastHandledNonceRef = useRef<number | null>(null);
  const lastHandledFaultNonceRef = useRef<number>(0);
  const lastHandledEngineerNonceRef = useRef<number>(0);
  const lastHandledFlyToNonceRef = useRef<number>(0);
  const prevCameraRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const onBoundsSettledRef = useRef(fetchOsmAssetsForBounds);
  onBoundsSettledRef.current = fetchOsmAssetsForBounds;

  const [basemapMode, setBasemapMode] = useState<BasemapMode>(isDark ? 'dark' : 'streets');
  const [hasUserChangedBasemap, setHasUserChangedBasemap] = useState<boolean>(false);
  const [mapboxRuntimeError, setMapboxRuntimeError] = useState<boolean>(false);
  const [activePopup, setActivePopup] = useState<ActiveOverlayPopup>(null);
  const [pulseOpacity, setPulseOpacity] = useState<number>(0.9);

  const reducedMotion = reconstruction?.reducedMotion ?? false;
  const effectiveSimulationOverlay = useMemo(() => {
    if (reconstruction) return null;
    if (simulationOverlay !== undefined) return simulationOverlay;
    return mapLayers.simulationOverlay ? activeSimulationOverlay : null;
  }, [reconstruction, simulationOverlay, mapLayers.simulationOverlay, activeSimulationOverlay]);

  // Sync default basemap with global Light/Dark theme unless operator explicitly chose Satellite/Streets
  useEffect(() => {
    if (!hasUserChangedBasemap) {
      setBasemapMode(isDark ? 'dark' : 'streets');
    }
  }, [isDark, hasUserChangedBasemap]);

  // Animated feeder & live-event pulse during Event Reconstruction, Simulation playback, or recent WebSocket arrivals
  useEffect(() => {
    const shouldAnimate =
      (Boolean(reconstruction?.isPlaying) ||
        Boolean(effectiveSimulationOverlay?.isPlaying) ||
        recentAnimatedAssetIds.length > 0) &&
      !reducedMotion;
    if (!shouldAnimate) {
      setPulseOpacity(0.92);
      return;
    }

    let rafId = 0;
    const animate = (ts: number) => {
      const wave = 0.45 + 0.5 * ((Math.sin(ts * 0.008) + 1) / 2);
      setPulseOpacity(wave);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [
    reconstruction?.isPlaying,
    effectiveSimulationOverlay?.isPlaying,
    recentAnimatedAssetIds.length,
    reducedMotion
  ]);

  // ResizeObserver ensuring Mapbox canvas always fits its panel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleResize = () => {
      mapRef.current?.resize();
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(el);
    window.addEventListener('resize', handleResize);
    const rafId = requestAnimationFrame(handleResize);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cleanup any pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const effectiveAssets = useMemo(() => {
    if (!reconstruction) return scopedDisplayAssets;
    const set = new Set(reconstruction.affectedAssetIds);
    return allAssets.filter(
      (a) =>
        set.has(a.canonicalId) ||
        (reconstruction.affectedFeederId && a.feederId === reconstruction.affectedFeederId)
    );
  }, [reconstruction, scopedDisplayAssets, allAssets]);

  const effectivePowerLines = useMemo(() => {
    if (!reconstruction) {
      return mapLayers.powerLines ? scopedDisplayPowerLines : [];
    }
    return allPowerLines.filter(
      (l) =>
        (reconstruction.affectedFeederId &&
          (l.canonicalId === reconstruction.affectedFeederId ||
            l.feederId === reconstruction.affectedFeederId)) ||
        reconstruction.affectedAssetIds.includes(l.canonicalId)
    );
  }, [reconstruction, mapLayers.powerLines, scopedDisplayPowerLines, allPowerLines]);

  const effectiveFaults = useMemo(() => {
    if (!reconstruction) {
      return mapLayers.faults ? scopedFaults : [];
    }
    return allFaults.filter(
      (f) => f.relatedEventId === reconstruction.eventId || f.id === reconstruction.eventId
    );
  }, [reconstruction, mapLayers.faults, scopedFaults, allFaults]);

  const filteredAssetsByLayer = useMemo(() => {
    if (reconstruction) return effectiveAssets;
    return effectiveAssets.filter((asset) => {
      switch (asset.assetType) {
        case 'SUBSTATION':
        case 'PLANT':
        case 'GENERATOR':
          return mapLayers.substations;
        case 'FEEDER':
          return mapLayers.feeders;
        case 'TRANSFORMER':
          return mapLayers.transformers;
        case 'CIRCUIT_BREAKER':
          return mapLayers.circuitBreakers;
        case 'SECTIONALIZER':
        case 'RECLOSER':
          return mapLayers.switches;
        case 'TOWER':
        case 'POLE':
        case 'ELECTRICAL_EQUIPMENT':
        case 'LOAD_POINT':
          return mapLayers.towersAndPoles;
        default:
          return true;
      }
    });
  }, [reconstruction, effectiveAssets, mapLayers]);

  const assetById = useMemo(
    () => new Map(allAssets.map((a) => [a.canonicalId, a])),
    [allAssets]
  );

  const lineById = useMemo(
    () => new Map(allPowerLines.map((l) => [l.canonicalId, l])),
    [allPowerLines]
  );

  const hasActivePath = Boolean(!reconstruction && selectedAssetId && connectedPath.nodeIds.size > 0);
  const highlightedSet = useMemo(() => new Set(highlightedAssetIds), [highlightedAssetIds]);

  // GeoJSON: Administrative Boundaries
  const boundariesGeoJson = useMemo(() => {
    if (readOnly || !mapLayers.states) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: scopedBoundaries
        .map((b) => {
          const ring = buildClosedLngLatRing(b.coordinates);
          if (ring.length < 4) return null;
          const style = getBoundaryStyle(b.level, hasRegionSelection);
          return {
            type: 'Feature' as const,
            id: b.id,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [ring]
            },
            properties: {
              id: b.id,
              level: b.level,
              state: b.state,
              name: b.name,
              color: style.color,
              fillColor: style.fillColor,
              fillOpacity: style.fillOpacity
            }
          };
        })
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
    };
  }, [readOnly, mapLayers.states, scopedBoundaries, hasRegionSelection]);

  // GeoJSON: Maintenance Zones
  const maintenanceGeoJson = useMemo(() => {
    if (readOnly || !mapLayers.maintenance) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: scopedMaintenanceZones
        .map((zone) => {
          const ring = buildClosedLngLatRing(zone.coordinates);
          if (ring.length < 4) return null;
          return {
            type: 'Feature' as const,
            id: zone.id,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [ring]
            },
            properties: {
              id: zone.id,
              zoneName: zone.zoneName,
              workOrderNumber: zone.workOrderNumber
            }
          };
        })
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
    };
  }, [readOnly, mapLayers.maintenance, scopedMaintenanceZones]);

  // GeoJSON: Event Reconstruction Affected Polygon
  const reconstructionPolygonGeoJson = useMemo(() => {
    if (!reconstruction || reconstruction.affectedAreaPolygon.length < 3) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    const ring = buildClosedLngLatRing(reconstruction.affectedAreaPolygon);
    if (ring.length < 4) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          id: `recon-poly-${reconstruction.eventId}`,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [ring]
          },
          properties: {
            eventId: reconstruction.eventId,
            title: reconstruction.title
          }
        }
      ]
    };
  }, [reconstruction]);

  // GeoJSON: Power Lines & Feeders
  const powerLinesGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: effectivePowerLines
        .filter((l) => l.path.length >= 2)
        .map((line) => {
          const isReconFeeder =
            reconstruction?.affectedFeederId === line.canonicalId ||
            reconstruction?.affectedFeederId === line.feederId;
          const isLineHighlighted =
            isReconFeeder ||
            connectedPath.lineIds.has(line.canonicalId) ||
            connectedPath.lineIds.has(line.feederId) ||
            selectedAssetId === line.canonicalId;

          const baseColor = isReconFeeder
            ? '#EF4444'
            : line.status === 'FAULTED'
              ? '#EF4444'
              : line.status === 'WARNING'
                ? '#F59E0B'
                : isLineHighlighted
                  ? '#22D3EE'
                  : line.source === 'OSM'
                    ? '#10B981'
                    : '#0284C7';

          const lineOpacity = isReconFeeder
            ? pulseOpacity
            : hasActivePath && !isLineHighlighted
              ? 0.25
              : 0.9;

          const lineWidth = isReconFeeder ? 5.5 : isLineHighlighted ? 5 : 3.5;

          return {
            type: 'Feature' as const,
            id: line.canonicalId,
            geometry: {
              type: 'LineString' as const,
              coordinates: line.path.map(([lat, lng]) => [lng, lat] as [number, number])
            },
            properties: {
              canonicalId: line.canonicalId,
              name: formatMissingValue(line.rawName ?? line.name),
              color: baseColor,
              opacity: lineOpacity,
              width: lineWidth,
              highlighted: isLineHighlighted || isReconFeeder ? 1 : 0,
              reconPulse: isReconFeeder ? 1 : 0
            }
          };
        })
    };
  }, [
    effectivePowerLines,
    reconstruction?.affectedFeederId,
    connectedPath.lineIds,
    selectedAssetId,
    hasActivePath,
    pulseOpacity
  ]);

  // GeoJSON: Clustered Point Assets (non-feeder or feeder centroids)
  const assetsGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: filteredAssetsByLayer
        .filter((a) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude))
        .map((asset) => {
          const telemetry = telemetryByAssetId[asset.canonicalId];
          const statusOverride = reconstruction?.assetStatuses[asset.canonicalId];
          const effectiveStatus = resolveEffectiveStatus(asset, telemetry, statusOverride);
          const color = getAssetPinColor(asset, effectiveStatus, Boolean(reconstruction));
          const isSelected =
            selectedAssetId === asset.canonicalId ||
            reconstruction?.activeStepAssetId === asset.canonicalId;
          const isHovered = hoveredAssetId === asset.canonicalId;
          const inPath = connectedPath.nodeIds.has(asset.canonicalId);
          const isHighlighted = highlightedSet.has(asset.canonicalId);
          const isDimmed = hasActivePath && !inPath && !isSelected && !isHovered;

          const isCompact = asset.osmType === 'tower' || asset.osmType === 'pole';
          const baseRadius = isCompact ? 6 : asset.assetType === 'SUBSTATION' ? 12 : 10;
          const radius = isSelected || isHovered ? baseRadius + 3 : isHighlighted ? baseRadius + 2 : baseRadius;

          return {
            type: 'Feature' as const,
            id: asset.canonicalId,
            geometry: {
              type: 'Point' as const,
              coordinates: [asset.longitude, asset.latitude] as [number, number]
            },
            properties: {
              canonicalId: asset.canonicalId,
              code: getAssetBadgeCode(asset),
              color,
              radius,
              opacity: isDimmed ? 0.28 : 0.96,
              strokeColor: isSelected
                ? '#22D3EE'
                : isHovered
                  ? '#FBBF24'
                  : inPath
                    ? '#38BDF8'
                    : '#FFFFFF',
              strokeWidth: isSelected || isHovered ? 3 : inPath ? 2.5 : 1.75,
              isHighlightedHalo: isSelected || isHovered || inPath || isHighlighted ? 1 : 0,
              isLiveAnimated: recentAnimatedAssetIds.includes(asset.canonicalId) ? 1 : 0,
              livePulseRadius:
                recentAnimatedAssetIds.includes(asset.canonicalId)
                  ? radius + 8 + Math.round(pulseOpacity * 10)
                  : 0,
              livePulseOpacity:
                recentAnimatedAssetIds.includes(asset.canonicalId)
                  ? Number((0.25 + pulseOpacity * 0.45).toFixed(2))
                  : 0
            }
          };
        })
    };
  }, [
    filteredAssetsByLayer,
    telemetryByAssetId,
    reconstruction,
    selectedAssetId,
    hoveredAssetId,
    connectedPath.nodeIds,
    highlightedSet,
    hasActivePath,
    recentAnimatedAssetIds,
    pulseOpacity
  ]);

  // GeoJSON: Fault Radius Polygons
  const faultRadiusGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: effectiveFaults.map((fault) => ({
        type: 'Feature' as const,
        id: `radius-${fault.id}`,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            createCirclePolygonRing(
              fault.longitude,
              fault.latitude,
              fault.faultRadiusMeters ?? 250
            )
          ]
        },
        properties: {
          faultId: fault.id,
          faultCode: fault.faultCode,
          severity: fault.severity
        }
      }))
    };
  }, [effectiveFaults]);

  // GeoJSON: Data Integrity Conflict Halo Circles
  const conflictGeoJson = useMemo(() => {
    if (readOnly || !mapLayers.conflicts) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: filteredAssetsByLayer
        .filter((a) => a.hasConflict)
        .map((asset) => ({
          type: 'Feature' as const,
          id: `conflict-${asset.canonicalId}`,
          geometry: {
            type: 'Point' as const,
            coordinates: [asset.longitude, asset.latitude] as [number, number]
          },
          properties: {
            canonicalId: asset.canonicalId
          }
        }))
    };
  }, [readOnly, mapLayers.conflicts, filteredAssetsByLayer]);

  // GeoJSON: Phase 5 What-If Simulation Overlays (Affected Service Area, Proposed Path, Temporary Route, Isolated Assets)
  const simulationAreaGeoJson = useMemo(() => {
    if (!effectiveSimulationOverlay || effectiveSimulationOverlay.affectedAreaPolygon.length < 3) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    const ring = buildClosedLngLatRing(effectiveSimulationOverlay.affectedAreaPolygon);
    if (ring.length < 4) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    const fillColor =
      effectiveSimulationOverlay.riskLevel === 'HIGH'
        ? '#EF4444'
        : effectiveSimulationOverlay.riskLevel === 'MEDIUM'
          ? '#F59E0B'
          : '#06B6D4';
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          id: `sim-area-${effectiveSimulationOverlay.simulationId}`,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [ring]
          },
          properties: {
            fillColor
          }
        }
      ]
    };
  }, [effectiveSimulationOverlay]);

  const simulationRoutesGeoJson = useMemo(() => {
    if (!effectiveSimulationOverlay) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    const features: Array<{
      type: 'Feature';
      id: string;
      geometry: { type: 'LineString'; coordinates: [number, number][] };
      properties: { kind: 'proposed' | 'temporary'; color: string; opacity: number };
    }> = [];

    if (effectiveSimulationOverlay.proposedFeederPath.length >= 2) {
      features.push({
        type: 'Feature',
        id: `sim-proposed-${effectiveSimulationOverlay.simulationId}`,
        geometry: {
          type: 'LineString',
          coordinates: effectiveSimulationOverlay.proposedFeederPath.map(([lat, lng]) => [lng, lat])
        },
        properties: {
          kind: 'proposed',
          color: '#0EA5E9',
          opacity: 0.72
        }
      });
    }

    if (effectiveSimulationOverlay.temporarySupplyPath.length >= 2) {
      features.push({
        type: 'Feature',
        id: `sim-temp-${effectiveSimulationOverlay.simulationId}`,
        geometry: {
          type: 'LineString',
          coordinates: effectiveSimulationOverlay.temporarySupplyPath.map(([lat, lng]) => [lng, lat])
        },
        properties: {
          kind: 'temporary',
          color: effectiveSimulationOverlay.riskLevel === 'HIGH' ? '#F97316' : '#10B981',
          opacity: pulseOpacity
        }
      });
    }

    return {
      type: 'FeatureCollection' as const,
      features
    };
  }, [effectiveSimulationOverlay, pulseOpacity]);

  const simulationIsolatedGeoJson = useMemo(() => {
    if (!effectiveSimulationOverlay || effectiveSimulationOverlay.isolatedAssetIds.length === 0) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    const isolatedSet = new Set(effectiveSimulationOverlay.isolatedAssetIds);
    return {
      type: 'FeatureCollection' as const,
      features: allAssets
        .filter((a) => isolatedSet.has(a.canonicalId))
        .map((a) => ({
          type: 'Feature' as const,
          id: `sim-iso-${a.canonicalId}`,
          geometry: {
            type: 'Point' as const,
            coordinates: [a.longitude, a.latitude] as [number, number]
          },
          properties: {
            canonicalId: a.canonicalId
          }
        }))
    };
  }, [effectiveSimulationOverlay, allAssets]);

  const riskOverlayGeoJson = useMemo(() => {
    if (reconstruction || !mapLayers.riskOverlay) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    const healthMap = new Map(aiSnapshot.healthScores.map((h) => [h.assetId, h]));
    const features = effectiveAssets
      .filter((a) => {
        const h = healthMap.get(a.canonicalId);
        return h && (h.category === 'CRITICAL' || h.category === 'WARNING');
      })
      .map((a) => {
        const h = healthMap.get(a.canonicalId)!;
        const radiusMeters = h.category === 'CRITICAL' ? 380 : 250;
        const ring = createCirclePolygonRing(a.longitude, a.latitude, radiusMeters, 28);
        return {
          type: 'Feature' as const,
          id: `risk-zone-${a.canonicalId}`,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [ring]
          },
          properties: {
            canonicalId: a.canonicalId,
            category: h.category,
            healthScore: h.healthScore,
            riskColor: h.category === 'CRITICAL' ? '#EF4444' : '#F59E0B',
            riskOpacity: h.category === 'CRITICAL' ? 0.16 : 0.11
          }
        };
      });
    return {
      type: 'FeatureCollection' as const,
      features
    };
  }, [reconstruction, mapLayers.riskOverlay, aiSnapshot.healthScores, effectiveAssets]);

  const fieldGeoFencesGeoJson = useMemo(() => {
    if (reconstruction || !showFieldWorkforce) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: geoFences.map((gf) => ({
        type: 'Feature' as const,
        id: gf.id,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [createCirclePolygonRing(gf.centerLon, gf.centerLat, gf.radiusMeters, 32)]
        },
        properties: {
          id: gf.id,
          name: gf.name,
          fenceType: gf.fenceType,
          strokeColor:
            gf.fenceType === 'FAULT_LOCATION'
              ? '#EF4444'
              : gf.fenceType === 'MAINTENANCE_ZONE'
                ? '#EAB308'
                : '#0EA5E9'
        }
      }))
    };
  }, [reconstruction, showFieldWorkforce, geoFences]);

  const fieldRoutesGeoJson = useMemo(() => {
    if (reconstruction || !showFieldWorkforce) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: engineerRoutes
        .filter((r) => r.coordinates.length >= 2)
        .map((r) => ({
          type: 'Feature' as const,
          id: r.routeId,
          geometry: {
            type: 'LineString' as const,
            coordinates: r.coordinates
          },
          properties: {
            routeId: r.routeId,
            engineerId: r.engineerId,
            isSelected: r.engineerId === selectedEngineerId ? 1 : 0,
            color: r.engineerId === selectedEngineerId ? '#06B6D4' : '#3B82F6'
          }
        }))
    };
  }, [reconstruction, showFieldWorkforce, engineerRoutes, selectedEngineerId]);

  const activePopupEngineer = useMemo(() => {
    if (activePopup?.kind !== 'engineer') return null;
    return fieldEngineers.find((e) => e.engineerId === activePopup.engineerId) || null;
  }, [activePopup, fieldEngineers]);

  useEffect(() => {
    if (!focusEngineerNonce || focusEngineerNonce === lastHandledEngineerNonceRef.current) return;
    if (!selectedEngineerId || !mapRef.current) return;
    const eng = fieldEngineers.find((e) => e.engineerId === selectedEngineerId);
    if (!eng) return;
    lastHandledEngineerNonceRef.current = focusEngineerNonce;
    mapRef.current.flyTo({
      center: [eng.longitude, eng.latitude],
      zoom: 14.5,
      duration: 900,
      essential: true
    });
  }, [focusEngineerNonce, selectedEngineerId, fieldEngineers]);

  const scheduleBoundsFetch = useCallback(() => {
    if (readOnly) return;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const b = map.getBounds();
      if (!b) return;
      onBoundsSettledRef.current(
        {
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast()
        },
        Math.round(map.getZoom())
      );
    }, 500);
  }, [readOnly]);

  // Sync camera on programmatic region filter center/zoom updates
  useEffect(() => {
    if (readOnly || reconstruction) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const next = { lat: mapCenter[0], lng: mapCenter[1], zoom: mapZoom };
    const prev = prevCameraRef.current;
    prevCameraRef.current = next;

    if (!prev) {
      map.jumpTo({ center: [next.lng, next.lat], zoom: next.zoom });
      return;
    }

    if (
      Math.abs(prev.lat - next.lat) > 0.0001 ||
      Math.abs(prev.lng - next.lng) > 0.0001 ||
      prev.zoom !== next.zoom
    ) {
      map.flyTo({
        center: [next.lng, next.lat],
        zoom: next.zoom,
        duration: 850,
        essential: true
      });
    }
  }, [mapCenter, mapZoom, readOnly, reconstruction]);

  // External fly-to (e.g., mobile Live Location FAB)
  useEffect(() => {
    if (!flyToRequest || flyToRequest.nonce === lastHandledFlyToNonceRef.current) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    lastHandledFlyToNonceRef.current = flyToRequest.nonce;
    const targetZoom = flyToRequest.zoom ?? Math.max(map.getZoom(), 13);
    prevCameraRef.current = {
      lat: flyToRequest.lat,
      lng: flyToRequest.lng,
      zoom: targetZoom
    };
    map.flyTo({
      center: [flyToRequest.lng, flyToRequest.lat],
      zoom: targetZoom,
      duration: 850,
      essential: true
    });
  }, [flyToRequest]);

  // Bidirectional sync: Knowledge Graph or Search focusRequest -> flyTo + open popup
  useEffect(() => {
    if (readOnly || reconstruction) return;
    if (!focusRequest) return;
    if (focusRequest.source === 'map') return;
    if (focusRequest.nonce === lastHandledNonceRef.current) return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    lastHandledNonceRef.current = focusRequest.nonce;
    const target = allAssets.find(
      (a) => a.canonicalId === focusRequest.assetId || a.id === focusRequest.assetId
    );
    if (!target) return;

    const targetZoom = Math.max(map.getZoom(), focusRequest.zoom ?? 15);
    prevCameraRef.current = {
      lat: target.latitude,
      lng: target.longitude,
      zoom: targetZoom
    };

    map.flyTo({
      center: [target.longitude, target.latitude],
      zoom: targetZoom,
      duration: 750,
      essential: true
    });

    if (focusRequest.openPopup !== false) {
      setActivePopup({
        kind: 'asset',
        id: target.canonicalId,
        lng: target.longitude,
        lat: target.latitude
      });
    }
  }, [focusRequest, allAssets, readOnly, reconstruction]);

  // Fault focus flyTo + open fault popup
  useEffect(() => {
    if (readOnly) return;
    if (!faultFocusNonce || faultFocusNonce === lastHandledFaultNonceRef.current) return;
    if (!selectedFaultId) return;

    const fault = allFaults.find(
      (f) => f.id === selectedFaultId || f.faultCode === selectedFaultId
    );
    const map = mapRef.current?.getMap();
    if (!fault || !map) return;

    lastHandledFaultNonceRef.current = faultFocusNonce;
    const targetZoom = Math.max(map.getZoom(), 16);
    prevCameraRef.current = {
      lat: fault.latitude,
      lng: fault.longitude,
      zoom: targetZoom
    };

    map.flyTo({
      center: [fault.longitude, fault.latitude],
      zoom: targetZoom,
      duration: 750,
      essential: true
    });

    setActivePopup({
      kind: 'fault',
      id: fault.id,
      lng: fault.longitude,
      lat: fault.latitude
    });
  }, [faultFocusNonce, selectedFaultId, allFaults, readOnly]);

  // Event Reconstruction fitBounds around affected assets + polygon
  useEffect(() => {
    if (!reconstruction) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    let count = 0;

    const includeCoord = (lat: number, lng: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      count += 1;
    };

    for (const a of effectiveAssets) {
      if (reconstruction.affectedAssetIds.includes(a.canonicalId)) {
        includeCoord(a.latitude, a.longitude);
      }
    }
    for (const l of effectivePowerLines) {
      for (const [lat, lng] of l.path) {
        includeCoord(lat, lng);
      }
    }
    for (const [lat, lng] of reconstruction.affectedAreaPolygon) {
      includeCoord(lat, lng);
    }

    if (count > 0) {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat]
        ],
        {
          padding: 40,
          maxZoom: 16,
          duration: reconstruction.reducedMotion ? 0 : 700
        }
      );
    }
  }, [
    reconstruction?.eventId,
    reconstruction?.fitBoundsNonce,
    reconstruction?.reducedMotion,
    effectiveAssets,
    effectivePowerLines
  ]);

  // Fit bounds automatically when dedicated simulationOverlay prop is active in Simulator Workspace
  useEffect(() => {
    if (!simulationOverlay || reconstruction) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    let count = 0;

    const addPt = (lat: number, lng: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      count += 1;
    };

    for (const id of simulationOverlay.participatingAssetIds) {
      const asset = assetById.get(id);
      if (asset) addPt(asset.latitude, asset.longitude);
    }
    for (const [lat, lng] of simulationOverlay.temporarySupplyPath) {
      addPt(lat, lng);
    }
    for (const [lat, lng] of simulationOverlay.affectedAreaPolygon) {
      addPt(lat, lng);
    }

    if (count > 0) {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat]
        ],
        { padding: 50, maxZoom: 15.5, duration: 650 }
      );
    }
  }, [simulationOverlay?.simulationId, reconstruction, assetById]);

  const handleAssetSelect = useCallback(
    (asset: InfrastructureAsset) => {
      if (readOnly) {
        selectAsset(asset.canonicalId, 'search', { openPopup: false });
        if (onSelectAsset) onSelectAsset(asset);
        return;
      }
      selectAsset(asset.canonicalId, 'map', { openPopup: true });
      setActivePopup({
        kind: 'asset',
        id: asset.canonicalId,
        lng: asset.longitude,
        lat: asset.latitude
      });
      if (onSelectAsset) onSelectAsset(asset);
    },
    [readOnly, selectAsset, onSelectAsset]
  );

  const handleFaultSelect = useCallback(
    (fault: ActiveFault) => {
      setSelectedFaultId(fault.id);
      selectAsset(fault.affectedAssetId, 'map', { openPopup: false });
      if (!readOnly) {
        setActivePopup({
          kind: 'fault',
          id: fault.id,
          lng: fault.longitude,
          lat: fault.latitude
        });
      }
      if (onSelectFault) onSelectFault(fault);
    },
    [readOnly, setSelectedFaultId, selectAsset, onSelectFault]
  );

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current?.getMap();
      const features = (e.features ?? []) as RenderedMapFeature[];

      if (features.length > 0 && map) {
        const clusterFeature = features.find((f) => f.layer?.id === 'clusters');
        if (clusterFeature) {
          const clusterId = clusterFeature.properties?.cluster_id as number | undefined;
          const coords = clusterFeature.geometry?.coordinates as [number, number] | undefined;
          const source = map.getSource('grid-assets') as GeoJSONSource | undefined;
          if (source && typeof clusterId === 'number' && coords) {
            source.getClusterExpansionZoom(clusterId, (err, zoomLevel) => {
              if (err || typeof zoomLevel !== 'number') return;
              map.easeTo({
                center: coords,
                zoom: Math.min(zoomLevel + 0.5, 17),
                duration: 500
              });
            });
          }
          return;
        }

        const assetFeature = features.find(
          (f) => f.layer?.id === 'unclustered-point' || f.layer?.id === 'unclustered-label'
        );
        if (assetFeature) {
          const cid = assetFeature.properties?.canonicalId as string | undefined;
          const asset = cid ? assetById.get(cid) : undefined;
          if (asset) {
            handleAssetSelect(asset);
          }
          return;
        }

        const conflictFeature = features.find((f) => f.layer?.id === 'conflict-points');
        if (conflictFeature) {
          const cid = conflictFeature.properties?.canonicalId as string | undefined;
          const asset = cid ? assetById.get(cid) : undefined;
          if (asset) {
            setActivePopup({
              kind: 'conflict',
              asset,
              lng: asset.longitude,
              lat: asset.latitude
            });
          }
          return;
        }

        const lineFeature = features.find((f) => f.layer?.id === 'power-lines-hit');
        if (lineFeature) {
          const cid = lineFeature.properties?.canonicalId as string | undefined;
          const line = cid ? lineById.get(cid) : undefined;
          if (line) {
            selectAsset(line.canonicalId, 'map', { openPopup: false });
            if (!readOnly) {
              setActivePopup({
                kind: 'line',
                line,
                lng: e.lngLat.lng,
                lat: e.lngLat.lat
              });
            }
          }
          return;
        }

        const maintFeature = features.find((f) => f.layer?.id === 'maintenance-fill');
        if (maintFeature) {
          const zid = maintFeature.properties?.id as string | undefined;
          const zone = scopedMaintenanceZones.find((z) => z.id === zid);
          if (zone) {
            setActivePopup({
              kind: 'maintenance',
              zone,
              lng: e.lngLat.lng,
              lat: e.lngLat.lat
            });
          }
          return;
        }

        const boundaryFeature = features.find((f) => f.layer?.id === 'boundaries-fill');
        if (boundaryFeature) {
          const bid = boundaryFeature.properties?.id as string | undefined;
          const boundary = scopedBoundaries.find((b) => b.id === bid);
          if (boundary) {
            if (boundary.level === 'STATE' && !hasRegionSelection) {
              updateGeoFilterLevel('state', boundary.state);
              return;
            }
            setActivePopup({
              kind: 'boundary',
              boundary,
              lng: e.lngLat.lng,
              lat: e.lngLat.lat
            });
          }
          return;
        }
      }

      setActivePopup(null);
      if (!readOnly) clearSelection();
    },
    [
      assetById,
      lineById,
      handleAssetSelect,
      selectAsset,
      readOnly,
      scopedMaintenanceZones,
      scopedBoundaries,
      hasRegionSelection,
      updateGeoFilterLevel,
      clearSelection
    ]
  );

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const features = (e.features ?? []) as RenderedMapFeature[];
      if (features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
        const assetFeature = features.find((f) => f.layer?.id === 'unclustered-point');
        const cid = assetFeature?.properties?.canonicalId as string | undefined;
        if (cid && !readOnly) {
          setHoveredAsset(cid, 'map');
        }
      } else {
        map.getCanvas().style.cursor = '';
        if (hoveredAssetId && !readOnly) {
          setHoveredAsset(null, 'map');
        }
      }
    },
    [readOnly, hoveredAssetId, setHoveredAsset]
  );

  const useFallbackStyle = !HAS_MAPBOX_TOKEN || mapboxRuntimeError;
  const activeStyle = useFallbackStyle ? OSM_FALLBACK_STYLE : MAPBOX_STYLES[basemapMode];

  const demoCount = effectiveAssets.filter((a) => a.source === 'DEMO').length;
  const osmCount = effectiveAssets.filter((a) => a.source === 'OSM').length;

  const activePopupAsset =
    activePopup?.kind === 'asset' ? assetById.get(activePopup.id) : undefined;
  const activePopupFault =
    activePopup?.kind === 'fault'
      ? allFaults.find((f) => f.id === activePopup.id)
      : undefined;

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} rounded-xl overflow-hidden relative isolate border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-100 dark:bg-slate-900`}
    >
      {/* Top Status & Basemap Controls */}
      {readOnly ? (
        <div className="absolute top-3 left-3 right-14 z-10 flex items-center justify-between gap-2 pointer-events-none">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow text-[10px] font-mono text-slate-700 dark:text-slate-200 pointer-events-auto">
            READ-ONLY RECONSTRUCTION MINI-MAP · {demoCount} DEMO ASSETS
          </div>
          {onOpenFullMap && (
            <button
              type="button"
              onClick={onOpenFullMap}
              className="pointer-events-auto px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-mono font-semibold shadow cursor-pointer transition-colors"
            >
              Open full Grid Map
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Basemap Switcher (Top-Left) */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-300 dark:border-slate-700 rounded-lg p-1 shadow-md">
            {(['dark', 'streets', 'satellite'] as BasemapMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setBasemapMode(mode);
                  setHasUserChangedBasemap(true);
                }}
                className={`px-2 py-1 rounded text-[10px] font-mono font-semibold uppercase transition-colors cursor-pointer ${
                  basemapMode === mode && !useFallbackStyle
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Center Status & Token Notice Pill */}
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-md w-[88%] sm:w-auto space-y-1.5 hidden md:block">
            {useFallbackStyle && (
              <div className="bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur border border-amber-500/60 rounded-xl px-3.5 py-2 shadow-lg text-center pointer-events-auto">
                <p className="text-[11px] font-mono font-semibold text-amber-800 dark:text-amber-200">
                  Mapbox access token not found. Please configure VITE_MAPBOX_ACCESS_TOKEN in the .env file.
                </p>
              </div>
            )}
            {currentMapZoom < 11 ? (
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-amber-500/40 rounded-xl px-3.5 py-1.5 shadow-lg text-center">
                <p className="text-[11px] font-mono text-slate-700 dark:text-slate-200">
                  Zoom {currentMapZoom} &lt; 11 · Select a District or zoom to 11+ to stream live OSM electricity assets
                </p>
              </div>
            ) : osmLoading ? (
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-cyan-500/40 rounded-xl px-3.5 py-1.5 shadow-lg text-center flex items-center justify-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                <p className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300">
                  Streaming live OSM electricity assets ({demoCount} DEMO loaded)...
                </p>
              </div>
            ) : (
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-1.5 shadow-lg text-center">
                <p className="text-[11px] font-mono text-slate-700 dark:text-slate-200">
                  {demoCount} DEMO · {osmCount} Live OSM{osmCached ? ' (Cached)' : ''} · Telemetry: {telemetrySourceType}
                  {osmError ? ' · Overpass unavailable (showing DEMO)' : ''}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Map Color Legend (Bottom-Left above ScaleControl) */}
      {!readOnly && (
        <div className="absolute bottom-9 left-3 z-10 bg-white/92 dark:bg-slate-900/92 backdrop-blur border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 shadow text-[10px] font-mono hidden sm:flex flex-wrap items-center gap-x-2.5 gap-y-1 max-w-lg pointer-events-none">
          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Substation
          </span>
          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Feeder
          </span>
          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" /> Transformer
          </span>
          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#9333EA]" /> Breaker/SW
          </span>
          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Fault
          </span>
          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308]" /> Maint
          </span>
        </div>
      )}

      <MapGL
        ref={mapRef}
        mapboxAccessToken={HAS_MAPBOX_TOKEN ? MAPBOX_TOKEN : undefined}
        mapStyle={activeStyle}
        initialViewState={{
          longitude: mapCenter[1],
          latitude: mapCenter[0],
          zoom: mapZoom,
          pitch: 0,
          bearing: 0
        }}
        minZoom={3}
        maxZoom={19}
        dragPan={true}
        scrollZoom={true}
        dragRotate={true}
        touchZoomRotate={true}
        attributionControl={false}
        interactiveLayerIds={[
          'clusters',
          'unclustered-point',
          'unclustered-label',
          'conflict-points',
          'power-lines-hit',
          'maintenance-fill',
          'boundaries-fill'
        ]}
        onLoad={() => scheduleBoundsFetch()}
        onMoveEnd={() => scheduleBoundsFetch()}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onError={(err) => {
          const msg = String(err?.error?.message ?? '');
          if (
            msg.toLowerCase().includes('unauthorized') ||
            msg.toLowerCase().includes('token') ||
            msg.toLowerCase().includes('401') ||
            msg.toLowerCase().includes('403')
          ) {
            setMapboxRuntimeError(true);
          }
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass showZoom visualizePitch />
        <FullscreenControl position="top-right" />
        <ScaleControl position="bottom-left" unit="metric" />
        <AttributionControl position="bottom-right" compact={true} />

        {/* Administrative Boundaries */}
        <Source id="boundaries" type="geojson" data={boundariesGeoJson}>
          <Layer
            id="boundaries-fill"
            type="fill"
            paint={{
              'fill-color': ['get', 'fillColor'],
              'fill-opacity': ['get', 'fillOpacity']
            }}
          />
          <Layer
            id="boundaries-line"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 1.5,
              'line-opacity': 0.75
            }}
          />
        </Source>

        {/* Planned Maintenance Zones */}
        <Source id="maintenance-zones" type="geojson" data={maintenanceGeoJson}>
          <Layer
            id="maintenance-fill"
            type="fill"
            paint={{
              'fill-color': '#EAB308',
              'fill-opacity': 0.22
            }}
          />
          <Layer
            id="maintenance-line"
            type="line"
            paint={{
              'line-color': '#CA8A04',
              'line-width': 2,
              'line-dasharray': [3, 2]
            }}
          />
        </Source>

        {/* Reconstruction Affected Area Polygon */}
        <Source id="reconstruction-polygon" type="geojson" data={reconstructionPolygonGeoJson}>
          <Layer
            id="reconstruction-fill"
            type="fill"
            paint={{
              'fill-color': '#EF4444',
              'fill-opacity': 0.18
            }}
          />
          <Layer
            id="reconstruction-line"
            type="line"
            paint={{
              'line-color': '#EF4444',
              'line-width': 2,
              'line-dasharray': [4, 2]
            }}
          />
        </Source>

        {/* Phase 7 AI Predictive Risk Overlay */}
        <Source id="ai-risk-overlay" type="geojson" data={riskOverlayGeoJson}>
          <Layer
            id="ai-risk-fill"
            type="fill"
            paint={{
              'fill-color': ['get', 'riskColor'],
              'fill-opacity': ['get', 'riskOpacity']
            }}
          />
          <Layer
            id="ai-risk-outline"
            type="line"
            paint={{
              'line-color': ['get', 'riskColor'],
              'line-width': 1.4,
              'line-dasharray': [2, 2],
              'line-opacity': 0.72
            }}
          />
        </Source>

        {/* Active Fault Radius Circles */}
        <Source id="fault-radii" type="geojson" data={faultRadiusGeoJson}>
          <Layer
            id="fault-radius-fill"
            type="fill"
            paint={{
              'fill-color': '#EF4444',
              'fill-opacity': 0.16
            }}
          />
          <Layer
            id="fault-radius-outline"
            type="line"
            paint={{
              'line-color': '#EF4444',
              'line-width': 1.8,
              'line-dasharray': [3, 2],
              'line-opacity': 0.85
            }}
          />
        </Source>

        {/* Power Lines & Connected Path Highlight */}
        <Source id="power-lines" type="geojson" data={powerLinesGeoJson}>
          <Layer
            id="power-lines-glow"
            type="line"
            filter={['==', ['get', 'highlighted'], 1]}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 10,
              'line-opacity': 0.22,
              'line-blur': 4
            }}
          />
          <Layer
            id="power-lines-main"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': ['get', 'width'],
              'line-opacity': ['get', 'opacity']
            }}
          />
          <Layer
            id="power-lines-hit"
            type="line"
            paint={{
              'line-color': '#000000',
              'line-opacity': 0,
              'line-width': 14
            }}
          />
        </Source>

        {/* Phase 5 What-If Simulation Overlays */}
        <Source id="simulation-area" type="geojson" data={simulationAreaGeoJson}>
          <Layer
            id="simulation-area-fill"
            type="fill"
            paint={{
              'fill-color': ['get', 'fillColor'],
              'fill-opacity': 0.12
            }}
          />
          <Layer
            id="simulation-area-outline"
            type="line"
            paint={{
              'line-color': ['get', 'fillColor'],
              'line-width': 1.8,
              'line-dasharray': [4, 2],
              'line-opacity': 0.8
            }}
          />
        </Source>

        <Source id="simulation-routes" type="geojson" data={simulationRoutesGeoJson}>
          <Layer
            id="simulation-proposed-line"
            type="line"
            filter={['==', ['get', 'kind'], 'proposed']}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 6,
              'line-opacity': 0.35
            }}
          />
          <Layer
            id="simulation-temporary-route"
            type="line"
            filter={['==', ['get', 'kind'], 'temporary']}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 4.5,
              'line-dasharray': [2.5, 1.8],
              'line-opacity': ['get', 'opacity']
            }}
          />
        </Source>

        <Source id="simulation-isolated" type="geojson" data={simulationIsolatedGeoJson}>
          <Layer
            id="simulation-isolated-halo"
            type="circle"
            paint={{
              'circle-radius': 17,
              'circle-color': '#F59E0B',
              'circle-opacity': 0.2,
              'circle-stroke-width': 2.4,
              'circle-stroke-color': '#F59E0B'
            }}
          />
        </Source>

        {/* Data Integrity Conflict Halos */}
        <Source id="conflict-markers" type="geojson" data={conflictGeoJson}>
          <Layer
            id="conflict-points"
            type="circle"
            paint={{
              'circle-radius': 18,
              'circle-color': '#FBBF24',
              'circle-opacity': 0.16,
              'circle-stroke-width': 1.8,
              'circle-stroke-color': '#F59E0B'
            }}
          />
        </Source>

        {/* Clustered Electrical Assets Layer */}
        <Source
          id="grid-assets"
          type="geojson"
          data={assetsGeoJson}
          cluster={!reconstruction && !readOnly}
          clusterMaxZoom={13}
          clusterRadius={48}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': [
                'step',
                ['get', 'point_count'],
                '#0891B2',
                15,
                '#2563EB',
                40,
                '#7C3AED'
              ],
              'circle-radius': ['step', ['get', 'point_count'], 18, 15, 22, 40, 26],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#E0F2FE'
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 12
            }}
            paint={{
              'text-color': '#FFFFFF'
            }}
          />
          <Layer
            id="live-event-pulse-halo"
            type="circle"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'isLiveAnimated'], 1]]}
            paint={{
              'circle-radius': ['get', 'livePulseRadius'],
              'circle-color': '#EF4444',
              'circle-opacity': ['get', 'livePulseOpacity'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#F87171'
            }}
          />
          <Layer
            id="unclustered-halo"
            type="circle"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'isHighlightedHalo'], 1]]}
            paint={{
              'circle-radius': ['+', ['get', 'radius'], 6],
              'circle-color': ['get', 'strokeColor'],
              'circle-opacity': 0.25
            }}
          />
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': ['get', 'radius'],
              'circle-opacity': ['get', 'opacity'],
              'circle-stroke-width': ['get', 'strokeWidth'],
              'circle-stroke-color': ['get', 'strokeColor']
            }}
          />
          <Layer
            id="unclustered-label"
            type="symbol"
            minzoom={9}
            filter={['!', ['has', 'point_count']]}
            layout={{
              'text-field': ['get', 'code'],
              'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
              'text-size': 8.5,
              'text-allow-overlap': true
            }}
            paint={{
              'text-color': '#FFFFFF',
              'text-opacity': ['get', 'opacity']
            }}
          />
        </Source>

        {/* Phase 11 Live Field Operations Geo-Fences & Navigation Routes */}
        {!reconstruction && showFieldWorkforce && (
          <>
            <Source id="field-geofences" type="geojson" data={fieldGeoFencesGeoJson}>
              <Layer
                id="field-geofences-fill"
                type="fill"
                paint={{
                  'fill-color': ['get', 'strokeColor'],
                  'fill-opacity': 0.08
                }}
              />
              <Layer
                id="field-geofences-outline"
                type="line"
                paint={{
                  'line-color': ['get', 'strokeColor'],
                  'line-width': 1.5,
                  'line-dasharray': [3, 2],
                  'line-opacity': 0.72
                }}
              />
            </Source>

            <Source id="field-routes" type="geojson" data={fieldRoutesGeoJson}>
              <Layer
                id="field-routes-casing"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': '#0F172A',
                  'line-width': ['case', ['==', ['get', 'isSelected'], 1], 7, 5],
                  'line-opacity': 0.35
                }}
              />
              <Layer
                id="field-routes-line"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': ['get', 'color'],
                  'line-width': ['case', ['==', ['get', 'isSelected'], 1], 4, 2.8],
                  'line-dasharray': [2, 1.5],
                  'line-opacity': 0.92
                }}
              />
            </Source>
          </>
        )}

        {/* Active Fault Pulsing Beacons */}
        {effectiveFaults.map((fault) => {
          const isFaultSelected = selectedFaultId === fault.id;
          return (
            <Marker
              key={`fault-beacon-${fault.id}`}
              longitude={fault.longitude}
              latitude={fault.latitude}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleFaultSelect(fault);
              }}
            >
              <button
                type="button"
                aria-label={`Active Fault ${fault.faultCode}`}
                title={`${fault.faultCode} [${fault.source}] — ${fault.title}`}
                className={`w-8 h-8 rounded-full bg-red-500 border-2 border-rose-100 flex items-center justify-center text-white font-mono font-extrabold text-sm cursor-pointer select-none ${
                  reducedMotion ? '' : 'fault-marker-pulse'
                } ${isFaultSelected ? 'ring-4 ring-rose-300 scale-110' : 'shadow-lg'}`}
              >
                ⚡
              </button>
            </Marker>
          );
        })}

        {/* Phase 11 Live Field Engineer Markers */}
        {!reconstruction &&
          showFieldWorkforce &&
          fieldEngineers.map((eng) => {
            const isSelectedEng = eng.engineerId === selectedEngineerId;
            const bgColor = getEngineerMarkerBg(eng.status);
            const initials = eng.name
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase();
            return (
              <Marker
                key={`engineer-marker-${eng.engineerId}`}
                longitude={eng.longitude}
                latitude={eng.latitude}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedEngineerId(eng.engineerId);
                  setActivePopup({
                    kind: 'engineer',
                    engineerId: eng.engineerId,
                    lng: eng.longitude,
                    lat: eng.latitude
                  });
                  onSelectEngineer?.(eng);
                }}
              >
                <button
                  type="button"
                  aria-label={`Field Engineer ${eng.name}`}
                  title={`${eng.name} (${eng.status}) · ${eng.team}`}
                  style={{ backgroundColor: bgColor }}
                  className={`px-1.5 h-7 rounded-full border-2 border-white text-white font-mono font-bold text-[10px] flex items-center gap-1 cursor-pointer select-none shadow-md transition-transform ${
                    isSelectedEng ? 'ring-4 ring-cyan-400 scale-110' : 'hover:scale-105'
                  }`}
                >
                  <span>{initials}</span>
                  <span className="text-[8.5px] opacity-90">{eng.status === 'TRAVELING' ? '→' : '●'}</span>
                </button>
              </Marker>
            );
          })}

        {/* Completed Field Task Check Badges */}
        {!reconstruction &&
          showFieldWorkforce &&
          fieldTasks
            .filter((t) => t.status === 'COMPLETED' || t.status === 'VERIFIED')
            .slice(0, 8)
            .map((t) => (
              <Marker
                key={`completed-job-${t.id}`}
                longitude={t.gpsLon}
                latitude={t.gpsLat}
                anchor="top-right"
              >
                <div
                  title={`Completed: ${t.taskCode} (${t.assetId})`}
                  className="w-4 h-4 rounded-full bg-emerald-600 border border-white text-white text-[9px] font-bold flex items-center justify-center shadow pointer-events-none"
                >
                  ✓
                </div>
              </Marker>
            ))}

        {/* Asset Details Popup */}
        {!readOnly && activePopup?.kind === 'asset' && activePopupAsset && (
          <Popup
            longitude={activePopup.lng}
            latitude={activePopup.lat}
            anchor="bottom"
            offset={14}
            closeOnClick={false}
            maxWidth="330px"
            onClose={() => setActivePopup(null)}
          >
            {(() => {
              const asset = activePopupAsset;
              const telemetry = telemetryByAssetId[asset.canonicalId];
              const effectiveStatus = resolveEffectiveStatus(asset, telemetry);
              return (
                <div className="font-mono text-xs p-1 space-y-2 w-[min(290px,calc(100vw-3rem))] sm:min-w-[285px] text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 gap-2">
                    <div className="flex items-center gap-1.5">
                      <SourceBadge source={asset.source} compact />
                      <span className="text-[10px] font-bold text-slate-600 uppercase">
                        {asset.assetType}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        effectiveStatus === 'FAULTED'
                          ? 'bg-rose-100 text-rose-700'
                          : effectiveStatus === 'WARNING' || effectiveStatus === 'MAINTENANCE'
                            ? 'bg-amber-100 text-amber-800'
                            : effectiveStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {effectiveStatus === 'UNKNOWN' ? 'Not available' : effectiveStatus}
                    </span>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-cyan-700 font-bold">
                      ID: {asset.canonicalId}
                    </div>
                    <div className="font-sans font-semibold text-slate-900 text-xs mt-0.5">
                      {formatMissingValue(asset.rawName ?? asset.name)}
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Voltage Level:</span>
                      <span className="font-semibold text-slate-900">
                        {formatMissingValue(asset.voltage)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">State / District / Area:</span>
                      <span className="font-semibold text-slate-900 text-right">
                        {formatMissingValue(asset.state)} · {formatMissingValue(asset.district)} ·{' '}
                        {formatMissingValue(asset.area)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Connected Feeder:</span>
                      <span className="font-semibold text-slate-900">
                        {formatMissingValue(asset.feederId)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Connected Substation:</span>
                      <span className="font-semibold text-slate-900">
                        {formatMissingValue(asset.substationId)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Lat / Lng:</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {asset.latitude.toFixed(4)}, {asset.longitude.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Installation Date:</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatMissingValue(asset.installationDate)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Last Inspection:</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatMissingValue(asset.lastInspectionDate)}
                      </span>
                    </div>
                    {(() => {
                      const health = getAssetHealth(asset.canonicalId);
                      const lifecycle = getAssetLifecycle(asset.canonicalId);
                      const healthColor =
                        health?.category === 'CRITICAL'
                          ? 'text-rose-700'
                          : health?.category === 'WARNING'
                            ? 'text-amber-700'
                            : 'text-emerald-700';
                      return (
                        <>
                          {health && (
                            <div className="flex justify-between gap-2 pt-1 border-t border-slate-100">
                              <span className="font-sans font-semibold text-indigo-700">AI Health Score:</span>
                              <span className={`font-bold tabular-nums ${healthColor}`}>
                                {health.healthScore}/100 ({health.category})
                              </span>
                            </div>
                          )}
                          {lifecycle && (
                            <div className="flex justify-between gap-2">
                              <span className="font-sans text-slate-500">Lifecycle Stage:</span>
                              <span className="font-semibold text-cyan-800">
                                {lifecycle.currentStage.replace('_', ' ')} ({lifecycle.totalInspections} insp.)
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Live Telemetry Section */}
                  <div className="p-2 rounded bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-semibold text-slate-700">Live Telemetry</span>
                      <SourceBadge source={telemetry ? telemetry.source : asset.source} compact />
                    </div>
                    {telemetry ? (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="font-sans text-slate-500">Load / Measured V:</span>
                          <span className="font-bold text-slate-900 tabular-nums">
                            {telemetry.loadKw !== null
                              ? `${telemetry.loadKw.toLocaleString()} kW`
                              : 'Not available'}{' '}
                            · {formatMissingValue(telemetry.voltage)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 text-[10px] text-slate-500">
                          <span className="font-sans">Last Updated:</span>
                          <span className="tabular-nums">
                            {formatUtcTimestamp(telemetry.lastUpdated)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-slate-500 font-sans">
                        No SCADA stream attached ({asset.source} status)
                      </div>
                    )}
                  </div>

                  {/* 4 Cross-Module Action Buttons */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => openKnowledgeGraphForAsset(asset.canonicalId)}
                      className="py-1.5 px-2 text-[11px] font-sans font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded transition-colors cursor-pointer"
                    >
                      Open Knowledge Graph
                    </button>
                    <button
                      type="button"
                      onClick={() => openEventReconstructionForAsset(asset.canonicalId)}
                      className="py-1.5 px-2 text-[11px] font-sans font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer"
                    >
                      View Event Timeline
                    </button>
                    <button
                      type="button"
                      onClick={() => launchSimulationForAsset(asset)}
                      className="py-1.5 px-2 text-[11px] font-sans font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors cursor-pointer"
                    >
                      Run What-If Simulation
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        inspectMaintenanceHistory(asset.canonicalId);
                        setActivePopup(null);
                      }}
                      className="py-1.5 px-2 text-[11px] font-sans font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors cursor-pointer"
                    >
                      View Maintenance History
                    </button>
                    <button
                      type="button"
                      onClick={() => openFieldTaskForAsset(asset.canonicalId)}
                      className="py-1.5 px-2 text-[11px] font-sans font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer"
                    >
                      Open Field Task
                    </button>
                    <button
                      type="button"
                      onClick={() => openKnowledgeGraphForAsset(asset.canonicalId)}
                      className="py-1.5 px-2 text-[11px] font-sans font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded transition-colors cursor-pointer"
                    >
                      Graph &amp; Lifecycle
                    </button>
                  </div>
                </div>
              );
            })()}
          </Popup>
        )}

        {/* Active Fault Popup */}
        {!readOnly && activePopup?.kind === 'fault' && activePopupFault && (
          <Popup
            longitude={activePopup.lng}
            latitude={activePopup.lat}
            anchor="bottom"
            offset={16}
            closeOnClick={false}
            maxWidth="310px"
            onClose={() => setActivePopup(null)}
          >
            {(() => {
              const fault = activePopupFault;
              const transformerList =
                fault.affectedTransformerIds && fault.affectedTransformerIds.length > 0
                  ? fault.affectedTransformerIds.join(', ')
                  : formatMissingValue(fault.affectedTransformerId);
              return (
                <div className="font-mono text-xs p-1 space-y-2 w-[min(280px,calc(100vw-3rem))] sm:min-w-[280px] text-slate-800">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-1 gap-2">
                    <span className="font-bold text-rose-600">{fault.faultCode}</span>
                    <div className="flex items-center gap-1">
                      <SourceBadge source={fault.source} compact />
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                        {fault.severity}
                      </span>
                    </div>
                  </div>
                  <div className="font-sans font-semibold text-slate-900 text-xs">{fault.title}</div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Fault ID:</span>
                      <span className="font-bold text-slate-900">{fault.faultCode}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Affected Feeder:</span>
                      <span className="font-bold text-slate-900">
                        {formatMissingValue(fault.affectedFeederId)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Affected Transformer(s):</span>
                      <span className="font-bold text-slate-900 text-right">{transformerList}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Time Detected:</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatUtcTimestamp(fault.detectedAt)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Current Status:</span>
                      <span className="font-bold text-slate-900">{fault.status}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => openEventReconstructionForFault(fault.id)}
                      className="w-full py-1.5 px-2.5 text-xs font-sans font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors cursor-pointer"
                    >
                      View Event Reconstruction
                    </button>
                    <button
                      type="button"
                      onClick={() => openKnowledgeGraphForAsset(fault.affectedAssetId)}
                      className="w-full py-1.5 px-2.5 text-xs font-sans font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-md transition-colors cursor-pointer"
                    >
                      Open Knowledge Graph
                    </button>
                    <button
                      type="button"
                      onClick={() => openFieldTaskForAsset(fault.affectedAssetId)}
                      className="w-full py-1.5 px-2.5 text-xs font-sans font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors cursor-pointer"
                    >
                      Open Field Task
                    </button>
                  </div>
                </div>
              );
            })()}
          </Popup>
        )}

        {/* Feeder / Power Line Popup */}
        {!readOnly && activePopup?.kind === 'line' && (
          <Popup
            longitude={activePopup.lng}
            latitude={activePopup.lat}
            anchor="bottom"
            closeOnClick={false}
            maxWidth="280px"
            onClose={() => setActivePopup(null)}
          >
            {(() => {
              const line = activePopup.line;
              return (
                <div className="font-mono text-xs p-1 space-y-2 w-[min(250px,calc(100vw-3rem))] sm:min-w-[250px] text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 gap-2">
                    <SourceBadge source={line.source} compact />
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      {line.status}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-cyan-700 font-bold">
                      ID: {line.canonicalId}
                    </div>
                    <div className="font-sans font-semibold text-slate-900 text-xs">
                      {formatMissingValue(line.rawName ?? line.name)}
                    </div>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Substation:</span>
                      <span className="font-semibold text-slate-900">
                        {formatMissingValue(line.substationId)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Voltage:</span>
                      <span className="font-semibold text-slate-900">
                        {formatMissingValue(line.voltage)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Operator:</span>
                      <span className="font-semibold text-slate-900 text-right">
                        {formatMissingValue(line.operator)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openKnowledgeGraphForAsset(line.canonicalId)}
                    className="w-full py-1.5 px-2.5 text-xs font-sans font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-md transition-colors cursor-pointer"
                  >
                    Inspect in Knowledge Graph
                  </button>
                </div>
              );
            })()}
          </Popup>
        )}

        {/* Maintenance Zone Popup */}
        {!readOnly && activePopup?.kind === 'maintenance' && (
          <Popup
            longitude={activePopup.lng}
            latitude={activePopup.lat}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setActivePopup(null)}
          >
            <div className="font-mono text-xs p-1 space-y-1.5 text-slate-800 w-[min(230px,calc(100vw-3rem))] sm:min-w-[230px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-amber-700">
                  {activePopup.zone.workOrderNumber}
                </span>
                <SourceBadge source={activePopup.zone.source} compact />
              </div>
              <div className="font-sans font-semibold text-slate-900">
                {activePopup.zone.zoneName}
              </div>
              <div className="text-[11px] text-slate-600">
                Feeder: {activePopup.zone.feederId} · Lead: {activePopup.zone.crewLead}
              </div>
            </div>
          </Popup>
        )}

        {/* Conflict Popup */}
        {!readOnly && activePopup?.kind === 'conflict' && (
          <Popup
            longitude={activePopup.lng}
            latitude={activePopup.lat}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setActivePopup(null)}
          >
            <div className="font-mono text-xs p-1 space-y-1.5 w-[min(230px,calc(100vw-3rem))] sm:min-w-[230px] text-slate-800">
              <div className="flex items-center justify-between gap-2">
                <SourceBadge source={activePopup.asset.source} compact />
                <span className="font-bold text-amber-700 text-[11px]">Data Integrity Flag</span>
              </div>
              <div className="font-bold text-slate-900">{activePopup.asset.canonicalId}</div>
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <div>Voltage: {formatMissingValue(activePopup.asset.voltage)}</div>
                <div>Operator: {formatMissingValue(activePopup.asset.operator)}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('integrity')}
                className="w-full py-1.5 px-2 text-xs font-sans font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors cursor-pointer"
              >
                Inspect in Data Integrity
              </button>
            </div>
          </Popup>
        )}

        {/* Boundary Popup */}
        {!readOnly && activePopup?.kind === 'boundary' && (
          <Popup
            longitude={activePopup.lng}
            latitude={activePopup.lat}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setActivePopup(null)}
          >
            <div className="font-mono text-xs p-1 space-y-1 text-slate-800">
              <div className="text-[10px] uppercase font-bold text-cyan-700">
                {activePopup.boundary.level.replace('_', ' ')}
              </div>
              <div className="font-bold text-slate-900">{activePopup.boundary.name}</div>
              <div className="font-sans text-[11px] text-slate-600">
                {[
                  activePopup.boundary.area,
                  activePopup.boundary.city,
                  activePopup.boundary.district,
                  activePopup.boundary.state
                ]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            </div>
          </Popup>
        )}

        {/* Phase 11 Live Engineer Popup */}
        {activePopup?.kind === 'engineer' && activePopupEngineer && (
          <Popup
            longitude={activePopup.lng}
            latitude={activePopup.lat}
            anchor="bottom"
            offset={16}
            closeOnClick={false}
            maxWidth="320px"
            onClose={() => setActivePopup(null)}
          >
            {(() => {
              const eng = activePopupEngineer;
              const route = engineerRoutes.find((r) => r.engineerId === eng.engineerId);
              const linkedTask = eng.currentTaskId
                ? fieldTasks.find((t) => t.id === eng.currentTaskId)
                : null;
              return (
                <div className="font-mono text-xs p-1 space-y-2 w-[min(270px,calc(100vw-3rem))] sm:min-w-[270px] text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 gap-2">
                    <span className="font-bold text-cyan-700">{eng.employeeId}</span>
                    <span
                      style={{ backgroundColor: getEngineerMarkerBg(eng.status) }}
                      className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
                    >
                      {eng.status}
                    </span>
                  </div>
                  <div>
                    <div className="font-sans font-bold text-slate-900 text-xs">{eng.name}</div>
                    <div className="font-sans text-[11px] text-slate-600">{eng.team}</div>
                  </div>
                  <div className="space-y-1 text-[11px] border-t border-slate-100 pt-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Assigned Task:</span>
                      <span className="font-bold text-slate-900">
                        {linkedTask?.taskCode || eng.currentTaskCode || 'Standby'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Target Asset:</span>
                      <span className="font-bold text-slate-900">
                        {linkedTask?.assetId || eng.currentAssetId || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">ETA / Progress:</span>
                      <span className="font-bold text-cyan-700 tabular-nums">
                        {route
                          ? `${route.etaMinutes} min (${route.progressPct}% · ${route.remainingDistanceKm} km)`
                          : 'On standby'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Battery / Net:</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {eng.batteryPct}% · {eng.networkStatus}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Contact:</span>
                      <span className="font-semibold text-slate-900">{eng.phone}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-sans text-slate-500">Email:</span>
                      <span className="text-slate-700 truncate">{eng.email}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => openKnowledgeGraphForEngineer(eng.engineerId)}
                      className="py-1.5 px-2 text-[11px] font-sans font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded transition-colors cursor-pointer"
                    >
                      Knowledge Graph
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateEngineerStepTowardTarget(eng.engineerId)}
                      className="py-1.5 px-2 text-[11px] font-sans font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer"
                    >
                      Step GPS Route
                    </button>
                  </div>
                </div>
              );
            })()}
          </Popup>
        )}
      </MapGL>
    </div>
  );
};
