import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { Core } from 'cytoscape';
import { useGrid } from '../../context/GridContext';
import type { GraphNodeData, SimulationMapOverlay } from '../../types/grid';
import { formatMissingValue } from '../../services/syntheticData';
import {
  buildHierarchicalKnowledgeGraph,
  getHierarchicalConnectedNodeIds
} from '../../services/intelligenceService';
import { SourceBadge } from '../ui/SourceBadge';
import { ZoomIn, ZoomOut, Maximize2, Layers } from 'lucide-react';

interface HoveredTooltipState {
  node: GraphNodeData;
  x: number;
  y: number;
}

interface KnowledgeGraphCanvasProps {
  heightClass?: string;
  compactLegend?: boolean;
  simulationOverlay?: SimulationMapOverlay | null;
  onSelectGraphNodeInspector?: (node: GraphNodeData | null) => void;
}

export const KnowledgeGraphCanvas: React.FC<KnowledgeGraphCanvasProps> = ({
  heightClass = 'h-[540px]',
  compactLegend = false,
  simulationOverlay = null,
  onSelectGraphNodeInspector
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const lastHandledNonceRef = useRef<number | null>(null);
  const lastTappedNodeIdRef = useRef<string | null>(null);

  const {
    isDark,
    assets,
    scopedAssets,
    powerLines,
    faults,
    eventReconstructions,
    telemetryByAssetId,
    selectedAssetId,
    hoveredAssetId,
    focusRequest,
    selectGraphNode,
    setHoveredAsset,
    clearSelection,
    aiSnapshot,
    fieldEngineers,
    fieldTasks,
    selectedEngineerId
  } = useGrid();

  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltipState | null>(null);
  const [includeGeoAndConsumerTiers, setIncludeGeoAndConsumerTiers] = useState<boolean>(true);
  const [includeFieldWorkforce, setIncludeFieldWorkforce] = useState<boolean>(true);
  const [activeGraphNodeId, setActiveGraphNodeId] = useState<string | null>(
    selectedEngineerId || selectedAssetId
  );

  const selectGraphNodeRef = useRef(selectGraphNode);
  selectGraphNodeRef.current = selectGraphNode;
  const setHoveredAssetRef = useRef(setHoveredAsset);
  setHoveredAssetRef.current = setHoveredAsset;
  const clearSelectionRef = useRef(clearSelection);
  clearSelectionRef.current = clearSelection;
  const inspectorCallbackRef = useRef(onSelectGraphNodeInspector);
  inspectorCallbackRef.current = onSelectGraphNodeInspector;

  // Keep local activeGraphNodeId aligned when selectedAssetId or selectedEngineerId changes externally
  useEffect(() => {
    if (selectedEngineerId && !selectedAssetId) {
      setActiveGraphNodeId(selectedEngineerId);
      return;
    }
    if (!selectedAssetId) {
      setActiveGraphNodeId(selectedEngineerId || null);
      return;
    }
    setActiveGraphNodeId((prev) => {
      if (prev && (prev.startsWith('GEO-') || prev === `CLU-${selectedAssetId}` || prev === selectedEngineerId)) {
        return prev;
      }
      return selectedAssetId;
    });
  }, [selectedAssetId, selectedEngineerId]);

  const topologyKey = useMemo(() => {
    const pool = scopedAssets.length > 0 ? scopedAssets : assets;
    return [
      includeGeoAndConsumerTiers ? '7TIER' : 'ELEC',
      includeFieldWorkforce ? 'FLD' : 'NOFLD',
      selectedEngineerId || '',
      pool
        .slice(0, 64)
        .map((a) => `${a.canonicalId}:${a.source}:${a.status}`)
        .join('|'),
      faults.map((f) => `${f.id}:${f.status}`).join(','),
      fieldEngineers.map((e) => `${e.engineerId}:${e.status}:${e.currentTaskId || ''}`).join(',')
    ].join('::');
  }, [
    scopedAssets,
    assets,
    faults,
    fieldEngineers,
    selectedEngineerId,
    includeGeoAndConsumerTiers,
    includeFieldWorkforce
  ]);

  const graphElements = useMemo(() => {
    const base = buildHierarchicalKnowledgeGraph({
      assets: scopedAssets,
      allAssets: assets,
      telemetryByAssetId,
      faults,
      reconstructions: eventReconstructions,
      selectedAssetId,
      includeGeoAndConsumerTiers,
      fieldEngineers: includeFieldWorkforce ? fieldEngineers : [],
      fieldTasks,
      selectedEngineerId
    });
    const healthMap = new Map(aiSnapshot.healthScores.map((h) => [h.assetId, h]));
    const predMap = new Map(aiSnapshot.predictions.map((p) => [p.assetId, p]));
    const enrichedNodes = base.nodes.map((n) => {
      const lookupId = n.data.canonicalId || n.data.id;
      const health = healthMap.get(lookupId);
      const pred = predMap.get(lookupId);
      return {
        ...n,
        data: {
          ...n.data,
          ...(health
            ? {
                aiHealthScore: health.healthScore,
                aiHealthCategory: health.category
              }
            : {}),
          ...(pred ? { aiRiskLevel: pred.riskLevel, aiFailureProb: pred.probabilityPct } : {})
        }
      };
    });
    const baseWithAi = { nodes: enrichedNodes, edges: base.edges };
    if (!simulationOverlay) return baseWithAi;

    const nodeIds = new Set(baseWithAi.nodes.map((n) => n.data.id));
    const extraEdges = [...baseWithAi.edges];
    if (
      simulationOverlay.tieSwitchId &&
      simulationOverlay.targetFeederId &&
      nodeIds.has(simulationOverlay.tieSwitchId) &&
      nodeIds.has(simulationOverlay.targetFeederId)
    ) {
      const existingTieIdx = extraEdges.findIndex(
        (e) =>
          (e.data.source === simulationOverlay.tieSwitchId &&
            e.data.target === simulationOverlay.targetFeederId) ||
          (e.data.source === simulationOverlay.targetFeederId &&
            e.data.target === simulationOverlay.tieSwitchId)
      );
      if (existingTieIdx >= 0) {
        extraEdges[existingTieIdx] = {
          data: {
            ...extraEdges[existingTieIdx].data,
            label: 'SIM_TEMP_SUPPLY',
            status: 'TIE_CLOSED'
          }
        };
      } else {
        extraEdges.push({
          data: {
            id: `sim-edge-${simulationOverlay.tieSwitchId}-${simulationOverlay.targetFeederId}`,
            source: simulationOverlay.tieSwitchId,
            target: simulationOverlay.targetFeederId,
            label: 'SIM_TEMP_SUPPLY',
            status: 'TIE_CLOSED'
          }
        });
      }
    }

    return { nodes: baseWithAi.nodes, edges: extraEdges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    topologyKey,
    aiSnapshot.recalculatedAt,
    simulationOverlay?.simulationId,
    simulationOverlay?.tieSwitchId,
    simulationOverlay?.targetFeederId
  ]);

  // Notify parent inspector when activeGraphNodeId resolves to a graph node
  useEffect(() => {
    if (!inspectorCallbackRef.current) return;
    if (!activeGraphNodeId) {
      inspectorCallbackRef.current(null);
      return;
    }
    const found = graphElements.nodes.find(
      (n) => n.data.id === activeGraphNodeId || n.data.canonicalId === activeGraphNodeId
    );
    inspectorCallbackRef.current(found?.data ?? null);
  }, [activeGraphNodeId, graphElements.nodes]);

  const activeHighlightId = activeGraphNodeId || selectedAssetId;

  const connectedNodeIds = useMemo(
    () =>
      getHierarchicalConnectedNodeIds(
        activeHighlightId,
        graphElements.nodes,
        graphElements.edges,
        assets,
        powerLines
      ),
    [activeHighlightId, graphElements.nodes, graphElements.edges, assets, powerLines]
  );

  // Mount & configure Cytoscape instance
  useEffect(() => {
    if (!containerRef.current || graphElements.nodes.length === 0) return;

    const cy = cytoscape({
      container: containerRef.current,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      elements: [...graphElements.nodes, ...graphElements.edges],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': '115px',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '9px',
            color: isDark ? '#E2E8F0' : '#1E293B',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'background-color': '#64748B',
            width: 30,
            height: 30,
            'border-width': 2,
            'border-color': isDark ? '#CBD5E1' : '#475569',
            'transition-property': 'opacity, border-width, border-color',
            'transition-duration': 180
          }
        },
        {
          selector: 'node[type = "STATE"]',
          style: {
            shape: 'round-octagon',
            width: 48,
            height: 44,
            'background-color': isDark ? '#312E81' : '#4F46E5',
            'border-color': '#A5B4FC',
            'font-weight': 'bold'
          }
        },
        {
          selector: 'node[type = "DISTRICT"]',
          style: {
            shape: 'round-tag',
            width: 42,
            height: 36,
            'background-color': isDark ? '#1E3A8A' : '#2563EB',
            'border-color': '#93C5FD'
          }
        },
        {
          selector: 'node[type = "SUBSTATION"], node[type = "PLANT"]',
          style: {
            shape: 'hexagon',
            width: 46,
            height: 46
          }
        },
        {
          selector: 'node[type = "FEEDER"]',
          style: {
            shape: 'round-rectangle',
            width: 36,
            height: 30
          }
        },
        {
          selector: 'node[type = "TRANSFORMER"]',
          style: {
            shape: 'ellipse',
            width: 30,
            height: 30
          }
        },
        {
          selector: 'node[type = "CIRCUIT_BREAKER"], node[type = "SECTIONALIZER"], node[type = "RECLOSER"]',
          style: {
            shape: 'diamond',
            width: 30,
            height: 30
          }
        },
        {
          selector: 'node[type = "CONSUMER_CLUSTER"]',
          style: {
            shape: 'triangle',
            width: 32,
            height: 30
          }
        },
        {
          selector: 'node[type = "FIELD_ENGINEER"]',
          style: {
            shape: 'star',
            width: 40,
            height: 40,
            'background-color': '#0EA5E9',
            'border-color': '#BAE6FD',
            'border-width': 3
          }
        },
        {
          selector: 'node[type = "INCIDENT"]',
          style: {
            shape: 'vee',
            width: 36,
            height: 34,
            'background-color': '#EF4444',
            'border-color': '#FECACA'
          }
        },
        {
          selector: 'node[type = "HISTORICAL_INCIDENT"]',
          style: {
            shape: 'barrel',
            width: 34,
            height: 30,
            'background-color': '#8B5CF6',
            'border-color': '#DDD6FE'
          }
        },
        {
          selector: 'node[status = "ACTIVE"][type != "STATE"][type != "DISTRICT"]',
          style: {
            'background-color': '#10B981',
            'border-color': '#6EE7B7'
          }
        },
        {
          selector: 'node[status = "WARNING"]',
          style: {
            'background-color': '#F59E0B',
            'border-color': '#FDE68A'
          }
        },
        {
          selector: 'node[status = "FAULTED"]',
          style: {
            'background-color': '#EF4444',
            'border-color': '#FECACA',
            'border-width': 3
          }
        },
        {
          selector: 'node[aiHealthCategory = "CRITICAL"]',
          style: {
            'border-color': '#F43F5E',
            'border-width': 3.5,
            'overlay-color': '#EF4444',
            'overlay-opacity': 0.14,
            'overlay-padding': 5
          }
        },
        {
          selector: 'edge',
          style: {
            width: 1.8,
            'line-color': isDark ? '#334155' : '#CBD5E1',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': isDark ? '#334155' : '#CBD5E1',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '7.5px',
            'font-family': 'JetBrains Mono, monospace',
            color: isDark ? '#94A3B8' : '#64748B',
            'text-rotation': 'autorotate',
            'text-margin-y': -6,
            'transition-property': 'opacity, line-color, width',
            'transition-duration': 180
          }
        },
        {
          selector: 'edge[status = "ISOLATED"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#EF4444',
            'target-arrow-color': '#EF4444'
          }
        },
        {
          selector: 'edge[status = "TIE_OPEN"]',
          style: {
            'line-style': 'dotted',
            'line-color': '#F59E0B',
            'target-arrow-color': '#F59E0B'
          }
        },
        {
          selector: 'edge[status = "TIE_CLOSED"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#10B981',
            'target-arrow-color': '#10B981',
            width: 3.4
          }
        },
        {
          selector: 'node.sim-participating',
          style: {
            opacity: 1,
            'border-width': 3.5,
            'border-color': '#10B981'
          }
        },
        {
          selector: 'node.sim-isolated',
          style: {
            opacity: 1,
            'border-width': 3.5,
            'border-color': '#F59E0B',
            'background-color': '#D97706'
          }
        },
        {
          selector: '.dimmed',
          style: {
            opacity: 0.18
          }
        },
        {
          selector: 'node.path-highlight',
          style: {
            opacity: 1,
            'border-width': 3,
            'border-color': '#38BDF8',
            'z-index': 500
          }
        },
        {
          selector: 'edge.path-highlight',
          style: {
            opacity: 1,
            width: 3.2,
            'line-color': '#06B6D4',
            'target-arrow-color': '#06B6D4',
            'z-index': 500
          }
        },
        {
          selector: 'node.selected-node',
          style: {
            opacity: 1,
            'border-width': 4,
            'border-color': '#22D3EE',
            'overlay-color': '#06B6D4',
            'overlay-opacity': 0.28,
            'overlay-padding': 7,
            'z-index': 999
          }
        },
        {
          selector: 'node.hover-highlight',
          style: {
            opacity: 1,
            'border-width': 4,
            'border-color': '#FBBF24',
            'overlay-color': '#F59E0B',
            'overlay-opacity': 0.25,
            'overlay-padding': 6,
            'z-index': 950
          }
        }
      ],
      layout: {
        name: graphElements.edges.length > 0 ? 'breadthfirst' : 'grid',
        directed: true,
        padding: 36,
        spacingFactor: 1.3,
        animate: false
      }
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const data = node.data() as GraphNodeData;
      lastTappedNodeIdRef.current = data.id;
      setActiveGraphNodeId(data.id);

      // Center Knowledge Graph smoothly on clicked node
      cy.animate(
        {
          center: { eles: node },
          zoom: Math.max(cy.zoom(), 1.1)
        },
        { duration: 320 }
      );

      // Synchronize Grid Map, Event Reconstruction, RCA, Simulator, Governance
      selectGraphNodeRef.current(data);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        lastTappedNodeIdRef.current = null;
        setActiveGraphNodeId(null);
        clearSelectionRef.current();
      }
    });

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const data = node.data() as GraphNodeData;
      const pos = node.renderedPosition();
      setHoveredTooltip({
        node: data,
        x: pos.x,
        y: pos.y
      });
      const targetHoverId =
        data.type === 'CONSUMER_CLUSTER' && data.targetAssetId
          ? data.targetAssetId
          : data.canonicalId || data.id;
      if (!targetHoverId.startsWith('GEO-')) {
        setHoveredAssetRef.current(targetHoverId, 'graph');
      }
    });

    cy.on('mouseout', 'node', () => {
      setHoveredTooltip(null);
      setHoveredAssetRef.current(null, 'graph');
    });

    cyRef.current = cy;

    let lastWidth = containerRef.current.clientWidth;
    const resizeObserver = new ResizeObserver((entries) => {
      cy.resize();
      const nextWidth = entries[0]?.contentRect.width ?? containerRef.current?.clientWidth ?? lastWidth;
      if (Math.abs(nextWidth - lastWidth) > 24) {
        lastWidth = nextWidth;
        cy.fit(undefined, 28);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      cyRef.current = null;
      cy.destroy();
    };
  }, [isDark, graphElements]);

  // React to shared selection & connected path highlighting + simulation overlay highlighting
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass('selected-node path-highlight dimmed sim-participating sim-isolated');

    if (simulationOverlay) {
      const simSet = new Set(simulationOverlay.participatingAssetIds);
      const isoSet = new Set(simulationOverlay.isolatedAssetIds);
      cy.nodes().forEach((n) => {
        const nid = n.id();
        if (isoSet.has(nid)) {
          n.addClass('sim-isolated');
        } else if (simSet.has(nid)) {
          n.addClass('sim-participating');
        } else if (!activeHighlightId) {
          n.addClass('dimmed');
        }
      });
      cy.edges().forEach((e) => {
        const src = e.data('source') as string;
        const tgt = e.data('target') as string;
        if (e.data('status') === 'TIE_CLOSED' || (simSet.has(src) && simSet.has(tgt))) {
          e.addClass('path-highlight');
        }
      });
    }

    const targetId = activeHighlightId;
    if (!targetId) {
      return;
    }

    const selectedNode = cy.getElementById(targetId);

    if (connectedNodeIds.size > 0) {
      cy.nodes().forEach((n) => {
        const nid = n.id();
        if (nid === targetId) {
          n.addClass('selected-node');
        } else if (connectedNodeIds.has(nid)) {
          n.addClass('path-highlight');
        } else {
          n.addClass('dimmed');
        }
      });

      cy.edges().forEach((e) => {
        const src = e.data('source') as string;
        const tgt = e.data('target') as string;
        if (connectedNodeIds.has(src) && connectedNodeIds.has(tgt)) {
          e.addClass('path-highlight');
        } else {
          e.addClass('dimmed');
        }
      });
    } else if (selectedNode && selectedNode.length > 0) {
      cy.elements().addClass('dimmed');
      selectedNode.removeClass('dimmed').addClass('selected-node');
      selectedNode.connectedEdges().removeClass('dimmed').addClass('path-highlight');
      selectedNode.neighborhood('node').removeClass('dimmed').addClass('path-highlight');
    }

    const isExternalFocus =
      focusRequest &&
      focusRequest.source !== 'graph' &&
      focusRequest.nonce !== lastHandledNonceRef.current;

    if (isExternalFocus && selectedNode && selectedNode.length > 0) {
      lastHandledNonceRef.current = focusRequest.nonce;
      cy.animate(
        {
          center: { eles: selectedNode },
          zoom: Math.max(cy.zoom(), 1.15)
        },
        { duration: 350 }
      );
    }
  }, [activeHighlightId, connectedNodeIds, focusRequest, graphElements, simulationOverlay]);

  // Cross-view hover highlight
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().removeClass('hover-highlight');
    if (!hoveredAssetId) return;

    const node = cy.getElementById(hoveredAssetId);
    if (node && node.length > 0) {
      node.addClass('hover-highlight');
      node.removeClass('dimmed');
    }
  }, [hoveredAssetId]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 30);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl relative overflow-hidden ${heightClass}`}
    >
      {/* Top-Right Graph Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center justify-end gap-1.5 max-w-[calc(100%-1.5rem)]">
        <button
          type="button"
          onClick={() => setIncludeFieldWorkforce((prev) => !prev)}
          title="Toggle Field Engineer -> Incident -> Asset -> Historical Incidents chain"
          className={`min-h-[44px] lg:min-h-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-medium flex items-center gap-1.5 backdrop-blur shadow-sm cursor-pointer transition-colors ${
            includeFieldWorkforce
              ? 'bg-sky-600 text-white border-sky-500'
              : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
          }`}
        >
          <span>{includeFieldWorkforce ? 'Workforce Chain' : 'Hide Crew'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIncludeGeoAndConsumerTiers((prev) => !prev)}
          title="Toggle 7-Tier Hierarchy (State -> District -> ... -> Consumer Cluster)"
          className={`min-h-[44px] lg:min-h-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-medium flex items-center gap-1.5 backdrop-blur shadow-sm cursor-pointer transition-colors ${
            includeGeoAndConsumerTiers
              ? 'bg-cyan-600 text-white border-cyan-500'
              : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {includeGeoAndConsumerTiers ? '7-Tier Hierarchy' : 'Electrical Only'}
          </span>
          <span className="sm:hidden">
            {includeGeoAndConsumerTiers ? '7-Tier' : 'Elec'}
          </span>
        </button>

        <div className="flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom in knowledge graph"
            className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 p-1.5 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom out knowledge graph"
            className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 p-1.5 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFit}
            title="Fit Topology"
            aria-label="Fit knowledge graph to screen"
            className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 p-1.5 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hover Node Tooltip with all 6 required attributes + Source Badge */}
      {hoveredTooltip && (
        <div
          className="pointer-events-none absolute z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl p-3 text-[11px] font-mono space-y-1.5 w-[min(270px,calc(100vw-2.5rem))] sm:min-w-[250px] sm:max-w-[300px]"
          style={{
            left: Math.min(
              Math.max(12, hoveredTooltip.x + 16),
              Math.max(12, (containerRef.current?.clientWidth || 320) - 270)
            ),
            top: Math.max(12, hoveredTooltip.y - 24)
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-cyan-600 dark:text-cyan-400 truncate">
              {hoveredTooltip.node.canonicalId}
            </span>
            <SourceBadge source={hoveredTooltip.node.source} compact />
          </div>
          <div className="font-sans font-semibold text-slate-900 dark:text-white text-xs truncate">
            {formatMissingValue(hoveredTooltip.node.assetName)}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className="text-slate-400">Type:</span>
            <span className="text-right font-semibold text-slate-700 dark:text-slate-200">
              {hoveredTooltip.node.type}
            </span>
            <span className="text-slate-400">Status:</span>
            <span
              className={`text-right font-bold ${
                hoveredTooltip.node.status === 'FAULTED'
                  ? 'text-rose-500'
                  : hoveredTooltip.node.status === 'WARNING'
                    ? 'text-amber-500'
                    : hoveredTooltip.node.status === 'ACTIVE'
                      ? 'text-emerald-500'
                      : 'text-slate-400'
              }`}
            >
              {hoveredTooltip.node.status}
            </span>
            <span className="text-slate-400">Voltage:</span>
            <span className="text-right text-slate-700 dark:text-slate-200">
              {formatMissingValue(hoveredTooltip.node.voltage)}
            </span>
            <span className="text-slate-400">Location:</span>
            <span className="text-right text-slate-700 dark:text-slate-200 truncate">
              {formatMissingValue(hoveredTooltip.node.geographicLocation)}
            </span>
            {hoveredTooltip.node.type === 'CONSUMER_CLUSTER' && (
              <>
                <span className="text-slate-400">Consumers:</span>
                <span className="text-right font-bold text-cyan-600 dark:text-cyan-400">
                  {formatMissingValue(hoveredTooltip.node.consumersCount)}
                </span>
              </>
            )}
            {(() => {
              const h = aiSnapshot.healthScores.find(
                (item) => item.assetId === (hoveredTooltip.node.canonicalId || hoveredTooltip.node.id)
              );
              if (!h) return null;
              return (
                <>
                  <span className="text-indigo-500">AI Health:</span>
                  <span
                    className={`text-right font-bold tabular-nums ${
                      h.category === 'CRITICAL'
                        ? 'text-rose-500'
                        : h.category === 'WARNING'
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                    }`}
                  >
                    {h.healthScore}/100 ({h.category})
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {!compactLegend && (
        <div className="absolute bottom-3 left-3 z-10 p-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-mono space-y-1 shadow-sm max-w-[92%]">
          <div className="font-bold text-slate-700 dark:text-slate-200">
            Hierarchy Sync ({graphElements.nodes.length} Nodes · {graphElements.edges.length} Edges)
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400">
            <span>State &rarr; District &rarr; Substation &rarr; Feeder &rarr; DTR &rarr; Switch &rarr; Cluster</span>
            <span className="text-emerald-500 font-semibold">● Normal</span>
            <span className="text-amber-500 font-semibold">● Warning</span>
            <span className="text-rose-500 font-semibold">● Fault</span>
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full touch-none" />
    </div>
  );
};

