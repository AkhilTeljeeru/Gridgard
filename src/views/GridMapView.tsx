import React, { useEffect, useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { GridMapComponent } from '../components/map/GridMapComponent';
import { KnowledgeGraphCanvas } from '../components/graph/KnowledgeGraphCanvas';
import { SourceBadge } from '../components/ui/SourceBadge';
import { AssetHealthGauge } from '../components/ai/AssetHealthGauge';
import { ResponsiveDrawer } from '../components/ui/ResponsiveDrawer';
import { formatMissingValue } from '../services/syntheticData';
import type {
  GeographicFilterState,
  GeographicSearchResult,
  MapFilterLayers
} from '../types/grid';
import {
  getAreas,
  getCities,
  getCountries,
  getDistricts,
  getDivisions,
  getFeeders,
  getStates,
  getSubdivisions,
  getSubstations,
  getTransformers,
  searchGeographyAndAssets
} from '../services/geographyService';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Columns2,
  Cpu,
  Filter,
  Globe,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Network,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Search,
  ShieldAlert,
  Wrench,
  X,
  Zap
} from 'lucide-react';

interface LayerToggleItem {
  key: keyof MapFilterLayers;
  label: string;
  colorClass: string;
}

const LAYER_TOGGLES: LayerToggleItem[] = [
  { key: 'substations', label: 'Substations', colorClass: 'bg-[#2563EB]' },
  { key: 'feeders', label: 'Feeders', colorClass: 'bg-[#10B981]' },
  { key: 'transformers', label: 'Distribution Transformers', colorClass: 'bg-[#F97316]' },
  { key: 'switches', label: 'Switches', colorClass: 'bg-[#9333EA]' },
  { key: 'circuitBreakers', label: 'Circuit Breakers', colorClass: 'bg-[#7E22CE]' },
  { key: 'powerLines', label: 'Power Lines', colorClass: 'bg-cyan-500' },
  { key: 'faults', label: 'Active Faults', colorClass: 'bg-[#EF4444]' },
  { key: 'riskOverlay', label: 'AI Risk Index Overlay', colorClass: 'bg-rose-500' },
  { key: 'maintenance', label: 'Maintenance Zones', colorClass: 'bg-[#EAB308]' },
  { key: 'states', label: 'Administrative Boundaries', colorClass: 'bg-sky-500' }
];

export const GridMapView: React.FC = () => {
  const {
    assets,
    boundaries,
    scopedAssets,
    scopedAssetCounts,
    scopedFaults,
    scopedMaintenanceZones,
    scopedDecisions,
    scopedIssues,
    telemetryByAssetId,
    telemetrySourceType,
    selectedAssetId,
    connectedPath,
    selectedFaultId,
    maintenanceFocusNonce,
    mapLayers,
    geoFilter,
    hasRegionSelection,
    geoScopeLabel,
    osmLoading,
    osmError,
    setMapLayers,
    updateGeoFilterLevel,
    resetGeoFilter,
    applySearchResult,
    selectAsset,
    focusFaultOnMap,
    openEventReconstructionForAsset,
    openEventReconstructionForFault,
    openKnowledgeGraphForAsset,
    openFieldTaskForAsset,
    fieldTasks,
    launchSimulationForAsset,
    raiseMaintenanceRequest,
    setActiveView,
    getAssetHealth,
    scopedAiSnapshot,
    prepareDecisionFromAiRecommendation,
    rolePermissions
  } = useGrid();

  const [filtersOpen, setFiltersOpen] = useState<boolean>(true);
  const [layersOpen, setLayersOpen] = useState<boolean>(true);
  const [splitSyncOpen, setSplitSyncOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [apiSearchResults, setApiSearchResults] = useState<GeographicSearchResult[] | null>(null);
  const [maintenanceBanner, setMaintenanceBanner] = useState<string | null>(null);
  const [highlightMaintPanel, setHighlightMaintPanel] = useState<boolean>(false);
  const [mobileSheet, setMobileSheet] = useState<'search' | 'layers' | 'inspector' | null>(null);
  const [tabletLeftOpen, setTabletLeftOpen] = useState<boolean>(false);
  const [tabletRightOpen, setTabletRightOpen] = useState<boolean>(false);
  const [flyToRequest, setFlyToRequest] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    nonce: number;
  } | null>(null);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);
  const [locationBanner, setLocationBanner] = useState<string | null>(null);

  const countryOptions = useMemo(() => getCountries(assets), [assets]);
  const stateOptions = useMemo(() => getStates(assets, geoFilter), [assets, geoFilter]);
  const districtOptions = useMemo(
    () => (geoFilter.state ? getDistricts(assets, geoFilter) : []),
    [assets, geoFilter]
  );
  const divisionOptions = useMemo(
    () => (geoFilter.district ? getDivisions(assets, geoFilter) : []),
    [assets, geoFilter]
  );
  const subdivisionOptions = useMemo(
    () => (geoFilter.district ? getSubdivisions(assets, geoFilter) : []),
    [assets, geoFilter]
  );
  const cityOptions = useMemo(
    () => (geoFilter.district ? getCities(assets, geoFilter) : []),
    [assets, geoFilter]
  );
  const areaOptions = useMemo(
    () => (geoFilter.city || geoFilter.district ? getAreas(assets, geoFilter) : []),
    [assets, geoFilter]
  );
  const substationOptions = useMemo(
    () => getSubstations(assets, geoFilter),
    [assets, geoFilter]
  );
  const feederOptions = useMemo(
    () => getFeeders(assets, geoFilter),
    [assets, geoFilter]
  );
  const transformerOptions = useMemo(
    () => getTransformers(assets, geoFilter),
    [assets, geoFilter]
  );

  // Query unified /api/map/search endpoint with instant local fallback
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setApiSearchResults(null);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/map/search?q=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.results)) {
          setApiSearchResults(data.results);
        }
      })
      .catch(() => {
        // Local search fallback handles results immediately
      });

    return () => controller.abort();
  }, [searchQuery]);

  // Flash Maintenance History card when clicked inside asset popup
  useEffect(() => {
    if (!maintenanceFocusNonce) return;
    setHighlightMaintPanel(true);
    const timer = window.setTimeout(() => setHighlightMaintPanel(false), 2600);
    return () => window.clearTimeout(timer);
  }, [maintenanceFocusNonce]);

  const localSearchResults = useMemo(
    () => searchGeographyAndAssets(assets, boundaries, searchQuery),
    [assets, boundaries, searchQuery]
  );

  const searchResults =
    apiSearchResults && apiSearchResults.length > 0 ? apiSearchResults : localSearchResults;

  const activeAsset = useMemo(() => {
    if (selectedAssetId) {
      const match = scopedAssets.find(
        (a) => a.canonicalId === selectedAssetId || a.id === selectedAssetId
      );
      if (match) return match;
    }
    return (
      scopedAssets.find((a) => a.assetType === 'SUBSTATION') ||
      scopedAssets[0] ||
      null
    );
  }, [scopedAssets, selectedAssetId]);

  const activeTelemetry = activeAsset ? telemetryByAssetId[activeAsset.canonicalId] : undefined;
  const activeHealth = activeAsset ? getAssetHealth(activeAsset.canonicalId) : undefined;
  const activeAiRecommendation = useMemo(
    () =>
      activeAsset
        ? scopedAiSnapshot.recommendations.find((r) => r.assetId === activeAsset.canonicalId)
        : undefined,
    [activeAsset, scopedAiSnapshot.recommendations]
  );

  const connectedPathAssets = useMemo(() => {
    if (connectedPath.nodeIds.size === 0) return [];
    const order: Record<string, number> = {
      SUBSTATION: 0,
      PLANT: 0,
      FEEDER: 1,
      CIRCUIT_BREAKER: 2,
      SECTIONALIZER: 2,
      RECLOSER: 2,
      TRANSFORMER: 3
    };
    return assets
      .filter((a) => connectedPath.nodeIds.has(a.canonicalId))
      .sort((a, b) => (order[a.assetType] ?? 9) - (order[b.assetType] ?? 9));
  }, [assets, connectedPath.nodeIds]);

  const assetMaintenanceHistory = useMemo(() => {
    const relatedZones = scopedMaintenanceZones.filter((z) => {
      if (!activeAsset) return true;
      return (
        z.feederId === activeAsset.feederId ||
        z.feederId === activeAsset.canonicalId ||
        activeAsset.assetType === 'SUBSTATION'
      );
    });
    const relatedMaintDecisions = scopedDecisions.filter(
      (d) =>
        activeAsset &&
        d.targetAssetId === activeAsset.canonicalId &&
        d.title.toLowerCase().includes('maintenance')
    );
    return { relatedZones, relatedMaintDecisions };
  }, [scopedMaintenanceZones, scopedDecisions, activeAsset]);

  const handleSelectSearch = (res: GeographicSearchResult) => {
    applySearchResult(res);
    setSearchQuery('');
    setApiSearchResults(null);
    setMobileSheet(null);
    setTabletLeftOpen(false);
  };

  const handleLiveLocation = () => {
    const fallbackToNearestAsset = (reason: string) => {
      const target = activeAsset || scopedAssets[0] || assets[0];
      if (target) {
        setFlyToRequest({
          lat: target.latitude,
          lng: target.longitude,
          zoom: 14,
          nonce: Date.now()
        });
        setLocationBanner(`${reason} Centered on nearest grid hub (${target.canonicalId}).`);
      } else {
        setLocationBanner(reason);
      }
      window.setTimeout(() => setLocationBanner(null), 5000);
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      fallbackToNearestAsset('Browser geolocation unavailable.');
      return;
    }

    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        setFlyToRequest({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          zoom: 13.5,
          nonce: Date.now()
        });
        setLocationBanner(
          `Centered on live GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}).`
        );
        window.setTimeout(() => setLocationBanner(null), 5000);
      },
      () => {
        setLocatingGps(false);
        fallbackToNearestAsset('GPS permission unavailable.');
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  };

  const handleToggleLayer = (key: keyof MapFilterLayers) => {
    setMapLayers((prev) => {
      const nextVal = !prev[key];
      if (key === 'states') {
        return {
          ...prev,
          states: nextVal,
          districtBoundaries: nextVal,
          cityBoundaries: nextVal,
          localityBoundaries: nextVal,
          serviceAreas: nextVal
        };
      }
      return {
        ...prev,
        [key]: nextVal
      };
    });
  };

  const handleRaiseMaintenance = () => {
    if (!activeAsset) return;
    const created = raiseMaintenanceRequest(activeAsset);
    setMaintenanceBanner(
      `Maintenance request ${created.decisionCode} raised for ${activeAsset.canonicalId}. Submitted to Decision Governance.`
    );
    window.setTimeout(() => setMaintenanceBanner(null), 6000);
  };

  const renderSelect = (
    label: string,
    key: keyof GeographicFilterState,
    value: string,
    options: Array<string | { id: string; label: string }>,
    disabled: boolean,
    placeholder: string
  ) => (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
        {label}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => updateGeoFilterLevel(key, e.target.value)}
        className="w-full min-h-[44px] lg:min-h-0 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-45 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.id;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );

  const unresolvedIssues = scopedIssues.filter((i) => i.status !== 'RESOLVED');

  const renderSearchPanel = () => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 relative">
      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Search className="w-3.5 h-3.5 text-cyan-500" />
        <span>Asset &amp; Location Search</span>
      </div>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="State, district, area, pincode, landmark, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchResults.length > 0) {
              handleSelectSearch(searchResults[0]);
            }
          }}
          className="w-full min-h-[44px] lg:min-h-0 pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {searchQuery.trim() && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto bg-white dark:bg-slate-900">
          {searchResults.length > 0 ? (
            searchResults.map((res) => (
              <button
                type="button"
                key={res.id}
                onClick={() => handleSelectSearch(res)}
                className="w-full min-h-[44px] text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {res.asset && <SourceBadge source={res.asset.source} compact />}
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {res.label}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {res.sublabel}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            ))
          ) : (
            <div className="p-2.5 text-xs text-slate-500 dark:text-slate-400">
              No matching regions, pincodes, or canonical assets found.
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderFiltersAndLayers = () => (
    <div className="space-y-4">
      {/* Cascading Geographic Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="min-h-[36px] flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-cyan-500" />
            <span>Geographic Filters</span>
            {filtersOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {hasRegionSelection && (
            <button
              type="button"
              onClick={resetGeoFilter}
              className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="p-3.5 space-y-2.5">
            {renderSelect('Country', 'country', geoFilter.country, countryOptions, false, 'Select Country')}
            {renderSelect(
              'State / Union Territory',
              'state',
              geoFilter.state,
              stateOptions,
              !geoFilter.country,
              `All States & UTs (${stateOptions.length} Available)`
            )}
            {renderSelect('District', 'district', geoFilter.district, districtOptions, !geoFilter.state, 'Select District...')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {renderSelect('Division', 'division', geoFilter.division, divisionOptions, divisionOptions.length === 0, 'All Divisions')}
              {renderSelect('Subdivision', 'subdivision', geoFilter.subdivision, subdivisionOptions, subdivisionOptions.length === 0, 'All Subdivisions')}
            </div>
            {renderSelect('City / Town', 'city', geoFilter.city, cityOptions, cityOptions.length === 0, 'All Cities / Towns')}
            {renderSelect('Area / Locality', 'area', geoFilter.area, areaOptions, areaOptions.length === 0, 'All Areas / Localities')}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              {renderSelect('Substation', 'substationId', geoFilter.substationId, substationOptions, substationOptions.length === 0, `All Substations (${substationOptions.length})`)}
              {renderSelect('Feeder', 'feederId', geoFilter.feederId, feederOptions, feederOptions.length === 0, `All Feeders (${feederOptions.length})`)}
              {renderSelect('Transformer', 'transformerId', geoFilter.transformerId, transformerOptions, transformerOptions.length === 0, `All Transformers (${transformerOptions.length})`)}
            </div>
          </div>
        )}
      </div>

      {/* Layer Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setLayersOpen((prev) => !prev)}
            className="min-h-[36px] flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-500" />
            <span>Layer Controls</span>
            {layersOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          <span className="text-[10px] font-mono text-slate-400">
            {LAYER_TOGGLES.filter((l) => mapLayers[l.key]).length}/{LAYER_TOGGLES.length} Active
          </span>
        </div>

        {layersOpen && (
          <div className="p-3.5 space-y-2.5">
            {LAYER_TOGGLES.map((item) => {
              const enabled = Boolean(mapLayers[item.key]);
              return (
                <div key={item.key} className="flex items-center justify-between gap-2 text-xs min-h-[32px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.colorClass}`} />
                    <span className="text-slate-700 dark:text-slate-300 truncate">{item.label}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`Toggle ${item.label}`}
                    onClick={() => handleToggleLayer(item.key)}
                    className={`relative inline-flex h-6 w-11 lg:h-5 lg:w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      enabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 lg:h-3.5 lg:w-3.5 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6 lg:translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4 max-w-[1600px] mx-auto">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Grid Geographic Intelligence
            </h2>
          </div>
          <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
            Interactive Mapbox GL network workspace with cascading regional filters, clustering, and Knowledge Graph sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Tablet Collapsible Sidebar Toggles (md to <lg) */}
          <button
            type="button"
            onClick={() => setTabletLeftOpen(true)}
            className="hidden md:inline-flex lg:hidden min-h-[44px] px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 items-center gap-1.5 cursor-pointer"
          >
            <PanelLeft className="w-4 h-4 text-cyan-500" />
            <span>Filters &amp; Layers</span>
          </button>

          <button
            type="button"
            onClick={() => setTabletRightOpen(true)}
            className="hidden md:inline-flex lg:hidden min-h-[44px] px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 items-center gap-1.5 cursor-pointer"
          >
            <PanelRight className="w-4 h-4 text-cyan-500" />
            <span>Inspector</span>
          </button>

          <button
            type="button"
            onClick={() => setSplitSyncOpen((prev) => !prev)}
            className={`min-h-[44px] lg:min-h-0 px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
              splitSyncOpen
                ? 'bg-cyan-600 text-white border-cyan-500'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>{splitSyncOpen ? 'Hide Split Sync' : 'Split Sync: Map + Graph'}</span>
          </button>

          <span className="hidden md:inline-block text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg truncate max-w-[260px]">
            {geoScopeLabel}
          </span>
          <button
            type="button"
            onClick={resetGeoFilter}
            className="hidden sm:flex min-h-[44px] lg:min-h-0 px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-500" />
            <span>India View</span>
          </button>
        </div>
      </div>

      {/* 3-Panel Layout: Desktop (25/55/20), Tablet (Full Map + Collapsible Drawers), Mobile (Full Map + FABs + Bottom Sheets) */}
      <div className="grid grid-cols-1 lg:grid-cols-[25fr_55fr_20fr] gap-4 items-stretch">
        {/* LEFT PANEL (Desktop >=1024px) */}
        <div className="hidden lg:block space-y-4">
          {renderSearchPanel()}
          {renderFiltersAndLayers()}
        </div>

        {/* CENTER PANEL: Interactive Mapbox GL Map (+ Split Sync Knowledge Graph) */}
        <div className="flex flex-col gap-3 min-w-0 h-full min-h-[460px] lg:min-h-[calc(100vh-11.5rem)]">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-mono uppercase text-slate-400 shrink-0 hidden sm:inline">
                Active Scope:
              </span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px] sm:max-w-none">
                {geoScopeLabel}
              </span>
            </div>

            <div className="flex items-center gap-2.5 font-mono text-[11px] tabular-nums shrink-0">
              {osmLoading && (
                <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading OSM</span>
                </span>
              )}
              <span className="text-slate-600 dark:text-slate-300">
                {scopedAssetCounts.totalAssets} Assets
              </span>
              <SourceBadge source={telemetrySourceType} compact />
              {scopedFaults.length > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  {scopedFaults.length} Fault{scopedFaults.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {locationBanner && (
            <div className="px-3.5 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 text-xs text-cyan-800 dark:text-cyan-200 flex items-center justify-between gap-2 shrink-0">
              <span className="flex items-center gap-2">
                <LocateFixed className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>{locationBanner}</span>
              </span>
            </div>
          )}

          {osmError && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2 shrink-0">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Live OSM Overpass feed unavailable ({osmError}). Displaying canonical registry data.</span>
              </span>
            </div>
          )}

          {splitSyncOpen ? (
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-3 min-h-[480px] lg:min-h-[560px] relative">
              <GridMapComponent
                heightClass="h-[360px] sm:h-[420px] lg:h-full min-h-[360px]"
                flyToRequest={flyToRequest}
              />
              <div className="flex flex-col gap-2 min-h-[360px]">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300 flex items-center justify-between">
                  <span>SYNCHRONIZED KNOWLEDGE GRAPH</span>
                  <span className="text-slate-400">Hover or click node &harr; map</span>
                </div>
                <KnowledgeGraphCanvas heightClass="flex-1 min-h-[340px]" compactLegend />
              </div>
            </div>
          ) : (
            <div className="relative flex-1 flex flex-col h-[calc(100dvh-13.5rem)] min-h-[460px] lg:min-h-[560px]">
              <GridMapComponent
                heightClass="flex-1 h-full min-h-[460px] lg:min-h-[560px]"
                flyToRequest={flyToRequest}
              />

              {/* Mobile Floating Action Buttons (FABs) on Map (<md) */}
              <div className="md:hidden absolute right-3 bottom-16 z-20 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setMobileSheet('search')}
                  aria-label="Search map assets and locations"
                  title="Search"
                  className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <Search className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSheet('layers')}
                  aria-label="Open map layers and geographic filters"
                  title="Layers & Filters"
                  className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </button>
                <button
                  type="button"
                  onClick={handleLiveLocation}
                  aria-label="Center map on live GPS location"
                  title="Live Location"
                  className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  {locatingGps ? (
                    <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                  ) : (
                    <LocateFixed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetGeoFilter}
                  aria-label="Reset map to India view"
                  title="Reset View"
                  className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </button>
              </div>

              {/* Mobile Floating Asset Inspector Trigger Pill (<md) */}
              <button
                type="button"
                onClick={() => setMobileSheet('inspector')}
                className="md:hidden absolute left-3 bottom-4 z-20 min-h-[44px] px-3.5 py-2 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-xl border border-cyan-400/50 inline-flex items-center gap-2 max-w-[calc(100%-5.5rem)] cursor-pointer"
              >
                <Zap className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {activeAsset ? `Inspect: ${activeAsset.canonicalId}` : 'Asset Inspector'}
                </span>
              </button>

              {scopedAssetCounts.totalAssets === 0 && (
                <div className="absolute inset-x-4 sm:inset-x-6 bottom-20 z-20 mx-auto max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-300 dark:border-slate-700 rounded-xl p-4 shadow-xl text-center space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    No grid assets mapped in {geoScopeLabel}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Zoom into level 11+ to query OpenStreetMap electrical infrastructure for this region, or reset filters to India view.
                  </p>
                  <button
                    type="button"
                    onClick={resetGeoFilter}
                    className="min-h-[44px] px-4 py-1.5 text-xs font-mono font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer"
                  >
                    Reset Geographic Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL (Desktop >=1024px) */}
        <div className="hidden lg:block space-y-4 min-w-0">
          {maintenanceBanner && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 space-y-1.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{maintenanceBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('decisions')}
                className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
              >
                Open Simulator &amp; Approvals &rarr;
              </button>
            </div>
          )}

          {/* Asset Summary & Current Status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-500" />
                <span>Asset Inspector</span>
              </h3>
              {activeAsset ? (
                <SourceBadge source={activeAsset.source} compact />
              ) : (
                <SourceBadge source="DEMO" compact />
              )}
            </div>

            {/* Scoped Counts (1:1 matched to map) */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase text-slate-400">
                Scoped Map Markers (1:1)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Substations</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {scopedAssetCounts.substations}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Feeders</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {scopedAssetCounts.feeders}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Transformers</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {scopedAssetCounts.transformers}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Breakers / SW</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {scopedAssetCounts.breakersAndSwitches}
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Asset Summary */}
            {activeAsset ? (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white truncate">
                    {activeAsset.canonicalId}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        activeAsset.status === 'FAULTED' || activeTelemetry?.status === 'FAULT'
                          ? 'text-rose-600 bg-rose-500/10'
                          : activeAsset.status === 'WARNING' || activeTelemetry?.status === 'WARNING'
                            ? 'text-amber-600 bg-amber-500/10'
                            : activeAsset.status === 'ACTIVE' || activeTelemetry?.status === 'NORMAL'
                              ? 'text-emerald-600 bg-emerald-500/10'
                              : 'text-slate-500 bg-slate-500/10'
                      }`}
                    >
                      {activeTelemetry?.status ?? activeAsset.status}
                    </span>
                  </div>
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-medium leading-snug">
                  {formatMissingValue(activeAsset.rawName ?? activeAsset.name)}
                </div>
                <div className="space-y-1 font-mono text-[11px] pt-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">Asset Type:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 uppercase">
                      {activeAsset.assetType}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">Voltage:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">
                      {formatMissingValue(activeAsset.voltage)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">Rated Capacity:</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {formatMissingValue(activeAsset.ratedCapacityKva, ' kVA')}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">Operator:</span>
                    <span className="text-slate-800 dark:text-slate-200 text-right">
                      {formatMissingValue(activeAsset.operator)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">Installation Date:</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {formatMissingValue(activeAsset.installationDate)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">Last Inspection:</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {formatMissingValue(activeAsset.lastInspectionDate)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">GPS:</span>
                    <span className="text-slate-800 dark:text-slate-200 tabular-nums">
                      {activeAsset.latitude.toFixed(4)}, {activeAsset.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Connected Assets (Interactive chips) */}
                {connectedPathAssets.length > 0 && (
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/25 space-y-1.5">
                    <div className="text-[10px] font-mono font-bold uppercase text-cyan-700 dark:text-cyan-300">
                      Connected Assets ({connectedPathAssets.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {connectedPathAssets.map((node) => (
                        <button
                          type="button"
                          key={node.canonicalId}
                          onClick={() =>
                            selectAsset(node.canonicalId, 'search', {
                              zoom: 16,
                              openPopup: true
                            })
                          }
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] border transition-colors cursor-pointer ${
                            node.canonicalId === activeAsset.canonicalId
                              ? 'bg-cyan-600 text-white border-cyan-500 font-bold'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-500'
                          }`}
                        >
                          {node.canonicalId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Telemetry Box */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-sans font-semibold">Live Telemetry</span>
                    <SourceBadge source={activeTelemetry?.source ?? telemetrySourceType} compact />
                  </div>
                  {activeTelemetry ? (
                    <>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 font-sans">Load:</span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {activeTelemetry.loadKw !== null
                            ? `${activeTelemetry.loadKw.toLocaleString()} kW`
                            : 'Not available'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 font-sans">Measured Voltage:</span>
                        <span className="text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatMissingValue(activeTelemetry.voltage)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Updated: {activeTelemetry.lastUpdated.replace('T', ' ').slice(0, 19)} UTC
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-400 font-sans">
                      Awaiting live telemetry reading...
                    </div>
                  )}
                </div>

                {/* Phase 7: AI Asset Health Score & Advisory */}
                {activeHealth && (
                  <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 space-y-2">
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold uppercase text-indigo-700 dark:text-indigo-300">
                      <span className="flex items-center gap-1">
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>AI Asset Health Index</span>
                      </span>
                      <span className="tabular-nums">{activeHealth.healthScore}/100</span>
                    </div>
                    <AssetHealthGauge health={activeHealth} compact />
                    {activeAiRecommendation && (
                      <div className="pt-1.5 border-t border-indigo-200/70 dark:border-indigo-800/50 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                          {activeAiRecommendation.recommendation}
                        </div>
                        <div className="text-[10px] text-indigo-700 dark:text-indigo-300 tabular-nums">
                          {activeAiRecommendation.confidenceScore}% conf. · {activeAiRecommendation.reasons[0]}
                        </div>
                        {!rolePermissions.isReadOnly && (
                          <button
                            type="button"
                            onClick={() => prepareDecisionFromAiRecommendation(activeAiRecommendation)}
                            className="w-full py-1 px-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Draft AI Governance Proposal &rarr;
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                Select any asset marker or Knowledge Graph node to inspect canonical metadata.
              </div>
            )}
          </div>

          {/* Active Alerts & Recent Faults */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                <span>Active Alerts &amp; Faults</span>
              </h4>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {scopedFaults.length + unresolvedIssues.length}
              </span>
            </div>

            {scopedFaults.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {scopedFaults.map((fault) => {
                  const isFaultSelected = selectedFaultId === fault.id;
                  return (
                    <div
                      key={fault.id}
                      onClick={() => focusFaultOnMap(fault.id)}
                      className={`p-3 rounded-lg space-y-1.5 text-xs cursor-pointer transition-colors border ${
                        isFaultSelected
                          ? 'bg-rose-100/90 dark:bg-rose-950/60 border-rose-500 ring-1 ring-rose-500'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 hover:border-rose-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-rose-600">
                          ⚡ {fault.faultCode}
                        </span>
                        <SourceBadge source={fault.source} compact />
                      </div>
                      <div className="font-medium text-slate-900 dark:text-white text-[11px] leading-snug">
                        {fault.title}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                        <span className="truncate">
                          {formatMissingValue(fault.affectedFeederId)} · {fault.detectedAt.slice(11, 19)} UTC
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEventReconstructionForFault(fault.id);
                          }}
                          className="text-rose-700 dark:text-rose-300 font-semibold hover:underline shrink-0 cursor-pointer"
                        >
                          Timeline &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                No active faults in the current scope.
              </div>
            )}

            {unresolvedIssues.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-1 text-xs">
                <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between gap-1 text-[11px]">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{unresolvedIssues.length} Data Integrity Finding(s)</span>
                  </span>
                  <SourceBadge source={unresolvedIssues[0].source} compact />
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-200/90 leading-snug">
                  {unresolvedIssues[0].canonicalAssetId}: {unresolvedIssues[0].issueType.replace(/_/g, ' ')}
                </p>
              </div>
            )}
          </div>

          {/* Maintenance History */}
          <div
            className={`bg-white dark:bg-slate-900 border rounded-xl p-4 space-y-2.5 transition-all ${
              highlightMaintPanel
                ? 'border-amber-500 ring-2 ring-amber-400/50'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-500" />
                <span>Maintenance History</span>
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                {assetMaintenanceHistory.relatedZones.length +
                  assetMaintenanceHistory.relatedMaintDecisions.length}
              </span>
            </div>

            {activeAsset && (
              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 flex justify-between gap-2">
                <span className="font-sans text-slate-500">Last Inspection:</span>
                <span className="font-semibold">
                  {formatMissingValue(activeAsset.lastInspectionDate)}
                </span>
              </div>
            )}

            {assetMaintenanceHistory.relatedZones.map((zone) => (
              <div
                key={zone.id}
                className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                  <span className="font-bold text-amber-700 dark:text-amber-300">
                    {zone.workOrderNumber}
                  </span>
                  <SourceBadge source={zone.source} compact />
                </div>
                <div className="font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                  {zone.zoneName}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {zone.status} · Crew: {zone.crewLead}
                </div>
              </div>
            ))}

            {assetMaintenanceHistory.relatedMaintDecisions.map((dec) => (
              <div
                key={dec.id}
                className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/50 text-xs space-y-1"
              >
                <div className="font-mono text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                  {dec.decisionCode} · {dec.status}
                </div>
                <div className="text-[11px] text-slate-800 dark:text-slate-200">{dec.title}</div>
              </div>
            ))}

            {assetMaintenanceHistory.relatedZones.length === 0 &&
              assetMaintenanceHistory.relatedMaintDecisions.length === 0 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  No open work orders linked to {activeAsset ? activeAsset.canonicalId : 'this scope'}.
                </div>
              )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 mb-1">
              Quick Actions
            </div>
            <button
              type="button"
              disabled={!activeAsset}
              onClick={() =>
                activeAsset &&
                selectAsset(activeAsset.canonicalId, 'search', { zoom: 16, openPopup: true })
              }
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span>Navigate to Asset</span>
            </button>
            <button
              type="button"
              onClick={() =>
                activeAsset
                  ? openKnowledgeGraphForAsset(activeAsset.canonicalId)
                  : setActiveView('graph')
              }
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Network className="w-3.5 h-3.5 shrink-0" />
              <span>Open Knowledge Graph</span>
            </button>
            <button
              type="button"
              onClick={() =>
                activeAsset
                  ? openEventReconstructionForAsset(activeAsset.canonicalId)
                  : setActiveView('events')
              }
              className="w-full py-1.5 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-cyan-500" />
                <span>View Timeline</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() =>
                activeAsset ? launchSimulationForAsset(activeAsset) : setActiveView('simulator')
              }
              className="w-full py-1.5 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-500" />
                <span>Run Simulation</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              disabled={!activeAsset}
              onClick={handleRaiseMaintenance}
              className="w-full py-1.5 px-3 text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors flex items-center justify-between disabled:opacity-50 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Raise Maintenance Request</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
            </button>
            <button
              type="button"
              disabled={!activeAsset}
              onClick={() => activeAsset && openFieldTaskForAsset(activeAsset.canonicalId)}
              className="w-full py-1.5 px-3 text-xs font-semibold text-indigo-800 dark:text-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors flex items-center justify-between disabled:opacity-50 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Open Field Task
                  {activeAsset &&
                  fieldTasks.some((t) => t.assetId === activeAsset.canonicalId)
                    ? ` (${
                        fieldTasks.find((t) => t.assetId === activeAsset.canonicalId)?.taskCode
                      })`
                    : ''}
                </span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet: Search */}
      <ResponsiveDrawer
        open={mobileSheet === 'search'}
        onClose={() => setMobileSheet(null)}
        title="Search Assets & Geography"
        subtitle="Jump directly to any state, feeder, or substation"
        variant="bottom"
      >
        {renderSearchPanel()}
      </ResponsiveDrawer>

      {/* Mobile Bottom Sheet: Filters & Layers */}
      <ResponsiveDrawer
        open={mobileSheet === 'layers'}
        onClose={() => setMobileSheet(null)}
        title="Map Layers & Geographic Filters"
        subtitle={geoScopeLabel}
        variant="bottom"
      >
        {renderFiltersAndLayers()}
      </ResponsiveDrawer>

      {/* Tablet Left Drawer: Search, Filters & Layers */}
      <ResponsiveDrawer
        open={tabletLeftOpen}
        onClose={() => setTabletLeftOpen(false)}
        title="Search, Filters & Layers"
        subtitle={geoScopeLabel}
        variant="left"
      >
        <div className="space-y-4">
          {renderSearchPanel()}
          {renderFiltersAndLayers()}
        </div>
      </ResponsiveDrawer>

      {/* Mobile Bottom Sheet & Tablet Right Drawer: Asset Details & Quick Actions */}
      <ResponsiveDrawer
        open={mobileSheet === 'inspector' || tabletRightOpen}
        onClose={() => {
          setMobileSheet(null);
          setTabletRightOpen(false);
        }}
        title={activeAsset ? `Asset: ${activeAsset.canonicalId}` : 'Asset Inspector'}
        subtitle={
          activeAsset
            ? `${activeAsset.assetType} · ${formatMissingValue(activeAsset.rawName ?? activeAsset.name)}`
            : geoScopeLabel
        }
        variant={tabletRightOpen ? 'right' : 'bottom'}
      >
        <div className="space-y-4 text-xs">
          {maintenanceBanner && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200">
              {maintenanceBanner}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-[10px] text-slate-400">Substations</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {scopedAssetCounts.substations}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-[10px] text-slate-400">Feeders</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {scopedAssetCounts.feeders}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-[10px] text-slate-400">Transformers</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {scopedAssetCounts.transformers}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-[10px] text-slate-400">Breakers / SW</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {scopedAssetCounts.breakersAndSwitches}
              </div>
            </div>
          </div>

          {activeAsset && (
            <div className="space-y-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {activeAsset.canonicalId}
                </span>
                <SourceBadge source={activeAsset.source} compact />
              </div>
              <div className="font-medium text-slate-700 dark:text-slate-300">
                {formatMissingValue(activeAsset.rawName ?? activeAsset.name)}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono pt-1 border-t border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-500">Status:</span>
                <span className="text-right font-bold">{activeTelemetry?.status ?? activeAsset.status}</span>
                <span className="text-slate-500">Voltage:</span>
                <span className="text-right">{formatMissingValue(activeAsset.voltage)}</span>
                <span className="text-slate-500">Load:</span>
                <span className="text-right font-bold tabular-nums">
                  {activeTelemetry?.loadKw !== null && activeTelemetry?.loadKw !== undefined
                    ? `${activeTelemetry.loadKw.toLocaleString()} kW`
                    : 'Not available'}
                </span>
              </div>
              {activeHealth && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <AssetHealthGauge health={activeHealth} compact />
                </div>
              )}
            </div>
          )}

          {scopedFaults.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono font-bold uppercase text-rose-600 dark:text-rose-400">
                Active Faults ({scopedFaults.length})
              </div>
              {scopedFaults.slice(0, 3).map((fault) => (
                <button
                  key={fault.id}
                  type="button"
                  onClick={() => {
                    focusFaultOnMap(fault.id);
                    setMobileSheet(null);
                    setTabletRightOpen(false);
                  }}
                  className="w-full min-h-[44px] text-left p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] font-bold text-rose-600">
                    <span>⚡ {fault.faultCode}</span>
                    <span>{fault.severity}</span>
                  </div>
                  <div className="text-[11px] text-slate-800 dark:text-slate-200 mt-0.5">
                    {fault.title}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={!activeAsset}
              onClick={() => {
                if (activeAsset) {
                  selectAsset(activeAsset.canonicalId, 'search', { zoom: 16, openPopup: true });
                }
                setMobileSheet(null);
                setTabletRightOpen(false);
              }}
              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              <span>Navigate to Asset</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSheet(null);
                setTabletRightOpen(false);
                if (activeAsset) {
                  openKnowledgeGraphForAsset(activeAsset.canonicalId);
                } else {
                  setActiveView('graph');
                }
              }}
              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Network className="w-4 h-4" />
              <span>Knowledge Graph</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSheet(null);
                setTabletRightOpen(false);
                if (activeAsset) {
                  openEventReconstructionForAsset(activeAsset.canonicalId);
                } else {
                  setActiveView('events');
                }
              }}
              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Clock className="w-4 h-4 text-cyan-500" />
              <span>Event Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSheet(null);
                setTabletRightOpen(false);
                if (activeAsset) {
                  launchSimulationForAsset(activeAsset);
                } else {
                  setActiveView('simulator');
                }
              }}
              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-cyan-500" />
              <span>Run Simulation</span>
            </button>
            <button
              type="button"
              disabled={!activeAsset}
              onClick={handleRaiseMaintenance}
              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>Maintenance Req</span>
            </button>
            <button
              type="button"
              disabled={!activeAsset}
              onClick={() => {
                if (activeAsset) openFieldTaskForAsset(activeAsset.canonicalId);
                setMobileSheet(null);
                setTabletRightOpen(false);
              }}
              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-indigo-800 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>Open Field Task</span>
            </button>
          </div>
        </div>
      </ResponsiveDrawer>
    </div>
  );
};
