import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { GridMapComponent, type ReconstructionMapOverlay } from '../components/map/GridMapComponent';
import { SourceBadge } from '../components/ui/SourceBadge';
import { AssetAiTimelinePanel } from '../components/ai/AssetAiTimelinePanel';
import { AssetHealthGauge } from '../components/ai/AssetHealthGauge';
import { formatMissingValue } from '../services/syntheticData';
import type { EventReconstructionIncident } from '../types/grid';
import { exportIncidentResolutionPdf } from '../services/incidentResolutionPdfReport';
import {
  Clock,
  AlertTriangle,
  BrainCircuit,
  Filter,
  MapPin,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Network,
  Users,
  Maximize2,
  ShieldAlert,
  SearchCheck,
  Cpu,
  FileCheck2,
  Download,
  Wrench
} from 'lucide-react';

type PlaybackSpeed = 0.5 | 1 | 2;
type StepVisualPhase = 'idle' | 'amber' | 'red';

function getStepDurationMs(speed: PlaybackSpeed): number {
  switch (speed) {
    case 0.5:
      return 2600;
    case 2:
      return 700;
    case 1:
    default:
      return 1400;
  }
}

export const EventReconstructionView: React.FC = () => {
  const {
    scopedEvents,
    scopedReconstructions,
    selectedReconstructionId,
    setSelectedReconstructionId,
    selectedAssetId,
    selectAsset,
    activeRootCauseAnalysis,
    focusRcaNonce,
    geoScopeLabel,
    hasRegionSelection,
    resetGeoFilter,
    focusAssetOnMap,
    focusFaultOnMap,
    openKnowledgeGraphForAsset,
    openFieldTaskForAsset,
    launchSimulationFromRca,
    prepareDecisionFromContext,
    decisions,
    fieldTasks,
    fieldEvidence,
    faults,
    assets,
    scenarios,
    setActiveView,
    recordResolutionReportExportAudit,
    getAssetHealth,
    getAssetTimeline,
    scopedAiSnapshot
  } = useGrid();

  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hydratedIncident, setHydratedIncident] = useState<EventReconstructionIncident | null>(null);
  const [apiConsumersDisplay, setApiConsumersDisplay] = useState<string | null>(null);
  const rcaSectionRef = useRef<HTMLDivElement | null>(null);

  // Playback & reduced motion state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [stepPhase, setStepPhase] = useState<StepVisualPhase>('idle');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [fitBoundsNonce, setFitBoundsNonce] = useState<number>(1);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const amberTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusRcaNonce > 0 && rcaSectionRef.current) {
      rcaSectionRef.current.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [focusRcaNonce, reducedMotion]);

  const clearPlaybackTimers = () => {
    if (amberTimerRef.current !== null) {
      window.clearTimeout(amberTimerRef.current);
      amberTimerRef.current = null;
    }
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  // Monitor prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Ensure selectedReconstructionId stays valid when geographic scope narrows
  const fallbackIncident = useMemo(() => {
    return (
      scopedReconstructions.find((r) => r.id === selectedReconstructionId) ||
      scopedReconstructions[0]
    );
  }, [scopedReconstructions, selectedReconstructionId]);

  useEffect(() => {
    if (fallbackIncident && fallbackIncident.id !== selectedReconstructionId) {
      setSelectedReconstructionId(fallbackIncident.id);
    }
  }, [fallbackIncident, selectedReconstructionId, setSelectedReconstructionId]);

  // Fetch canonical reconstruction payload from backend GET /api/events/:id/reconstruction
  useEffect(() => {
    const targetId = fallbackIncident?.id;
    if (!targetId) return;

    const controller = new AbortController();
    setHydratedIncident(null);
    setApiConsumersDisplay(null);

    fetch(`/api/events/${encodeURIComponent(targetId)}/reconstruction`, {
      signal: controller.signal
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || controller.signal.aborted) return;
        setHydratedIncident(data as EventReconstructionIncident);
        if (typeof data.affectedConsumersDisplay === 'string') {
          setApiConsumersDisplay(data.affectedConsumersDisplay);
        }
      })
      .catch(() => {
        // Fallback to local syntheticData reconstruction cleanly
      });

    return () => controller.abort();
  }, [fallbackIncident?.id]);

  const activeIncident = hydratedIncident ?? fallbackIncident;

  // Reset timeline when active incident changes
  useEffect(() => {
    clearPlaybackTimers();
    setIsPlaying(false);
    setCurrentStepIndex(-1);
    setStepPhase('idle');
    setFitBoundsNonce((n) => n + 1);
  }, [activeIncident?.id]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearPlaybackTimers();
    };
  }, []);

  // Drive Normal -> Amber -> Red chronological animation while playing
  useEffect(() => {
    clearPlaybackTimers();
    if (!isPlaying || !activeIncident) return;

    const steps = activeIncident.steps;
    if (steps.length === 0) {
      setIsPlaying(false);
      return;
    }

    if (currentStepIndex < 0) {
      setCurrentStepIndex(0);
      setStepPhase('amber');
      selectAsset(steps[0].assetId, 'search', { zoom: 16, openPopup: false });
      return;
    }

    const duration = getStepDurationMs(speed);
    const amberDuration = reducedMotion ? Math.round(duration * 0.2) : Math.round(duration * 0.45);

    if (stepPhase === 'amber') {
      amberTimerRef.current = window.setTimeout(() => {
        setStepPhase('red');
      }, amberDuration);
      return () => clearPlaybackTimers();
    }

    if (stepPhase === 'red') {
      if (currentStepIndex >= steps.length - 1) {
        setIsPlaying(false);
        return;
      }
      advanceTimerRef.current = window.setTimeout(() => {
        const nextIdx = currentStepIndex + 1;
        setCurrentStepIndex(nextIdx);
        setStepPhase('amber');
        selectAsset(steps[nextIdx].assetId, 'search', { zoom: 16, openPopup: false });
      }, duration - amberDuration);
      return () => clearPlaybackTimers();
    }
  }, [isPlaying, currentStepIndex, stepPhase, speed, reducedMotion, activeIncident, selectAsset]);

  // Build progressive asset status map: Normal -> Amber -> Red in chronological order
  const reconstructionOverlay = useMemo<ReconstructionMapOverlay | undefined>(() => {
    if (!activeIncident) return undefined;

    const statuses: Record<string, 'ACTIVE' | 'WARNING' | 'FAULTED'> = {};
    for (const aid of activeIncident.affectedAssetIds) {
      statuses[aid] = 'ACTIVE';
    }
    if (activeIncident.feederId && !statuses[activeIncident.feederId]) {
      statuses[activeIncident.feederId] = 'ACTIVE';
    }

    if (currentStepIndex >= 0) {
      for (let i = 0; i <= currentStepIndex && i < activeIncident.steps.length; i += 1) {
        const step = activeIncident.steps[i];
        if (i < currentStepIndex) {
          statuses[step.assetId] = 'FAULTED';
        } else {
          statuses[step.assetId] = stepPhase === 'amber' ? 'WARNING' : 'FAULTED';
        }
      }
    }

    const activeStep =
      currentStepIndex >= 0 && currentStepIndex < activeIncident.steps.length
        ? activeIncident.steps[currentStepIndex]
        : null;

    return {
      eventId: activeIncident.id,
      title: activeIncident.title,
      affectedAssetIds: activeIncident.affectedAssetIds,
      affectedFeederId: activeIncident.feederId,
      affectedAreaPolygon: activeIncident.affectedAreaPolygon,
      activeStepAssetId: activeStep?.assetId ?? selectedAssetId,
      assetStatuses: statuses,
      isPlaying,
      reducedMotion,
      fitBoundsNonce
    };
  }, [activeIncident, currentStepIndex, stepPhase, selectedAssetId, isPlaying, reducedMotion, fitBoundsNonce]);

  const handlePlayToggle = () => {
    if (!activeIncident || activeIncident.steps.length === 0) return;
    if (isPlaying) {
      clearPlaybackTimers();
      setIsPlaying(false);
      return;
    }
    // Restart from Step 1 if idle or already finished at final step
    if (currentStepIndex < 0 || (currentStepIndex >= activeIncident.steps.length - 1 && stepPhase === 'red')) {
      setCurrentStepIndex(0);
      setStepPhase('amber');
      selectAsset(activeIncident.steps[0].assetId, 'search', { zoom: 16, openPopup: false });
    } else if (stepPhase === 'idle') {
      setStepPhase('amber');
    }
    setIsPlaying(true);
  };

  const handleStepBack = () => {
    if (!activeIncident || activeIncident.steps.length === 0) return;
    clearPlaybackTimers();
    setIsPlaying(false);
    if (currentStepIndex <= 0) {
      setCurrentStepIndex(-1);
      setStepPhase('idle');
      return;
    }
    const prevIdx = currentStepIndex - 1;
    setCurrentStepIndex(prevIdx);
    setStepPhase('red');
    selectAsset(activeIncident.steps[prevIdx].assetId, 'search', { zoom: 16, openPopup: false });
  };

  const handleStepForward = () => {
    if (!activeIncident || activeIncident.steps.length === 0) return;
    clearPlaybackTimers();
    setIsPlaying(false);
    const nextIdx = Math.min(activeIncident.steps.length - 1, currentStepIndex + 1);
    setCurrentStepIndex(nextIdx);
    setStepPhase('red');
    selectAsset(activeIncident.steps[nextIdx].assetId, 'search', { zoom: 16, openPopup: false });
  };

  const handleResetPlayback = () => {
    clearPlaybackTimers();
    setIsPlaying(false);
    setCurrentStepIndex(-1);
    setStepPhase('idle');
    setFitBoundsNonce((n) => n + 1);
  };

  const handleSelectStep = (idx: number) => {
    if (!activeIncident) return;
    const step = activeIncident.steps[idx];
    if (!step) return;
    clearPlaybackTimers();
    setIsPlaying(false);
    setCurrentStepIndex(idx);
    setStepPhase('red');
    selectAsset(step.assetId, 'search', { zoom: 16, openPopup: false });
  };

  const filteredEvents = scopedEvents.filter((e) => {
    if (filterSource === 'ALL') return true;
    return e.sourceSystem === filterSource;
  });

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'SCADA_OSI':
        return 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
      case 'OMS_ORACLE':
        return 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'LINEWORKER_RADIO':
        return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'WEATHER_RADAR':
        return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const activeStep =
    activeIncident && currentStepIndex >= 0 ? activeIncident.steps[currentStepIndex] : null;
  const consumersLabel =
    apiConsumersDisplay ??
    (activeIncident
      ? formatMissingValue(activeIncident.affectedConsumersCount, ' Consumers')
      : 'Not available');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Module 2: Event Reconstruction &amp; Visual Outage Playback
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Animated fault cascade timelines synchronized 1:1 with the Grid Map polygon overlay and Knowledge Graph.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasRegionSelection && (
            <button
              type="button"
              onClick={resetGeoFilter}
              className="px-2.5 py-1 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors cursor-pointer"
            >
              Scope: {geoScopeLabel} (Clear)
            </button>
          )}
        </div>
      </div>

      {/* Incident Tabs (3 Demo Fault Cascades) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scopedReconstructions.map((inc) => {
          const isCurrent = inc.id === activeIncident?.id;
          return (
            <button
              key={inc.id}
              type="button"
              onClick={() => {
                setSelectedReconstructionId(inc.id);
                const primaryAsset = inc.affectedTransformerIds[0] || inc.feederId || inc.affectedAssetIds[0];
                if (primaryAsset) {
                  selectAsset(primaryAsset, 'events', { zoom: 15, openPopup: false });
                }
              }}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500 ring-1 ring-rose-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                  {inc.faultCode}
                </span>
                <div className="flex items-center gap-1">
                  <SourceBadge source={inc.source} compact />
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      inc.severity === 'CRITICAL'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {inc.severity}
                  </span>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                {inc.title}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span>Feeder: {formatMissingValue(inc.feederId)}</span>
                <span>{inc.steps.length} Steps</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Split Event Reconstruction + Read-Only Mini-Map Studio */}
      {activeIncident && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          {/* Incident Metadata Summary */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                  {activeIncident.faultCode} · {activeIncident.id}
                </span>
                <SourceBadge source={activeIncident.source} compact />
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {activeIncident.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {activeIncident.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl">
                {activeIncident.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase text-slate-400 block">Affected Feeder</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatMissingValue(activeIncident.feederId)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase text-slate-400 block">Transformer(s)</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {activeIncident.affectedTransformerIds.length > 0
                    ? activeIncident.affectedTransformerIds.join(', ')
                    : 'Not available'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3 text-cyan-500" />
                  <span>Affected Consumers</span>
                </span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {consumersLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Playback Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 sm:px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePlayToggle}
                className="min-h-[44px] lg:min-h-0 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={handleStepBack}
                disabled={currentStepIndex < 0}
                className="min-h-[44px] lg:min-h-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500 disabled:opacity-40 text-xs font-mono flex items-center gap-1 cursor-pointer"
                title="Previous Step"
              >
                <SkipBack className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Step Back</span>
              </button>

              <button
                type="button"
                onClick={handleStepForward}
                disabled={currentStepIndex >= activeIncident.steps.length - 1}
                className="min-h-[44px] lg:min-h-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500 disabled:opacity-40 text-xs font-mono flex items-center gap-1 cursor-pointer"
                title="Next Step"
              >
                <span className="hidden sm:inline">Step Forward</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleResetPlayback}
                className="min-h-[44px] lg:min-h-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500 text-xs font-mono flex items-center gap-1 cursor-pointer"
                title="Reset Playback & Re-fit Map"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-0.5 text-[11px] font-mono">
                <span className="px-2 text-slate-500">Speed:</span>
                {([0.5, 1, 2] as PlaybackSpeed[]).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSpeed(spd)}
                    className={`min-h-[36px] lg:min-h-0 px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                      speed === spd
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                Step {currentStepIndex >= 0 ? currentStepIndex + 1 : 0} / {activeIncident.steps.length}
                {activeStep && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 rounded font-bold ${
                      stepPhase === 'amber'
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {stepPhase === 'amber' ? 'WARNING' : 'FAULTED'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Split Timeline + Mini-Map */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Ordered Cascade Steps */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span>Ordered Cascade Steps</span>
                <span>Click step to highlight Map &amp; Graph</span>
              </div>

              <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {activeIncident.steps.map((step, idx) => {
                  const isCurrent = idx === currentStepIndex;
                  const isCompleted = idx < currentStepIndex;
                  const isAmber = isCurrent && stepPhase === 'amber';
                  const isAssetSynced = selectedAssetId === step.assetId;

                  return (
                    <div
                      key={step.stepId}
                      onClick={() => handleSelectStep(idx)}
                      className={`relative rounded-xl border p-3.5 cursor-pointer transition-all ${
                        isCurrent
                          ? isAmber
                            ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 ring-1 ring-amber-500 shadow-sm'
                            : 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 ring-1 ring-rose-500 shadow-sm'
                          : isCompleted
                            ? 'border-rose-300/70 dark:border-rose-800/60 bg-rose-50/20 dark:bg-rose-950/10'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 hover:border-cyan-500/60'
                      }`}
                    >
                      <div
                        className={`absolute -left-[22px] top-4 w-3.5 h-3.5 rounded-full border-2 ${
                          isAmber
                            ? 'bg-amber-400 border-amber-200'
                            : isCurrent || isCompleted
                              ? 'bg-rose-500 border-rose-200'
                              : 'bg-emerald-500 border-emerald-200'
                        }`}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            STEP {step.stepNumber}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {step.timestamp.replace('T', ' ').slice(0, 19)} UTC
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <SourceBadge source={step.source} compact />
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getSourceBadgeColor(
                              step.sourceSystem
                            )}`}
                          >
                            {step.sourceSystem}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {step.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {step.summary}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <span
                          className={`font-bold ${
                            isAssetSynced
                              ? 'text-cyan-600 dark:text-cyan-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          Asset: {step.assetId}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openKnowledgeGraphForAsset(step.assetId);
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-600/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-600/20 flex items-center gap-1 cursor-pointer"
                        >
                          <Network className="w-3 h-3" />
                          <span>Knowledge Graph</span>
                        </button>
                      </div>

                      {step.hasContradiction && step.contradictionDetail && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
                          <strong>Telemetry Note:</strong> {step.contradictionDetail}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Read-Only Mini-Map beside Timeline */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Interactive Outage Corridor Map (Read-Only)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFitBoundsNonce((n) => n + 1)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Re-fit Bounds</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openKnowledgeGraphForAsset(
                        activeStep?.assetId || activeIncident.affectedAssetIds[0]
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-cyan-600/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/20 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <Network className="w-3 h-3" />
                    <span>Open Knowledge Graph</span>
                  </button>
                </div>
              </div>

              <GridMapComponent
                readOnly
                heightClass="h-[300px] sm:h-[400px] lg:h-[460px]"
                reconstruction={reconstructionOverlay}
                onOpenFullMap={() => focusFaultOnMap(activeIncident.faultId)}
              />

              {/* Legend & Reduced Motion Notice */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Normal
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    Transient / Tripping
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    Faulted / Outage
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-2 border border-dashed border-rose-500 bg-rose-500/20 inline-block" />
                    Affected Area Polygon
                  </span>
                </div>
                {reducedMotion && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    prefers-reduced-motion active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Synchronized Root Cause Analysis & Recovery Handoff */}
      <div
        ref={rcaSectionRef}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Root Cause Analysis · {activeRootCauseAnalysis.id}
              </h3>
              <SourceBadge source={activeRootCauseAnalysis.source} compact />
              <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 font-semibold tabular-nums">
                {activeRootCauseAnalysis.confidencePct}% Evidence Confidence
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {activeRootCauseAnalysis.rootCauseSummary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openKnowledgeGraphForAsset(activeRootCauseAnalysis.canonicalAssetId)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Network className="w-3.5 h-3.5 text-cyan-500" />
              <span>Knowledge Graph</span>
            </button>
            <button
              type="button"
              onClick={() => launchSimulationFromRca(activeRootCauseAnalysis)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Simulate Recovery ({activeRootCauseAnalysis.recommendedTransferMva.toFixed(1)} MVA)</span>
            </button>
            <button
              type="button"
              onClick={() => prepareDecisionFromContext()}
              className="px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Propose Decision</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Initiating Trigger &amp; Impact
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {activeRootCauseAnalysis.initiatingTrigger}
            </p>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 font-mono text-[11px] flex justify-between gap-2">
              <span className="text-slate-500">Consumer Cluster:</span>
              <span className="font-semibold text-slate-900 dark:text-white text-right tabular-nums">
                {activeRootCauseAnalysis.consumerClusterLabel}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Protection &amp; Propagation Sequence
            </div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {activeRootCauseAnalysis.protectionSequence.slice(0, 5).map((item, idx) => (
                <li key={idx} className="truncate" title={item}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Recommended Switching &amp; Caveats
            </div>
            <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
              {activeRootCauseAnalysis.recommendedActionTitle}
            </p>
            {activeRootCauseAnalysis.dataIntegrityCaveats.length > 0 ? (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                <strong>Integrity Caveat:</strong> {activeRootCauseAnalysis.dataIntegrityCaveats[0]}
              </div>
            ) : (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                Telemetry &amp; canonical GIS identifiers verified consistent.
              </div>
            )}
          </div>
        </div>

        {/* Phase 7: AI Predictive Risk Forecast & 7-Stage Asset AI Timeline */}
        {(() => {
          const targetId = activeRootCauseAnalysis.canonicalAssetId;
          const health = getAssetHealth(targetId);
          const prediction = scopedAiSnapshot.predictions.find((p) => p.assetId === targetId);
          const timeline = getAssetTimeline(targetId);
          if (!health && timeline.length === 0) return null;
          return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="lg:col-span-5 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <BrainCircuit className="w-4 h-4" />
                    <span>AI Post-Incident Risk Forecast</span>
                  </span>
                  {prediction && (
                    <span className="tabular-nums font-mono text-[11px]">
                      {prediction.confidenceScore}% conf.
                    </span>
                  )}
                </div>
                {health && <AssetHealthGauge health={health} compact showFactors />}
                {prediction && (
                  <div className="pt-2 border-t border-indigo-200/70 dark:border-indigo-800/50 text-xs space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {prediction.failureType.replace(/_/g, ' ')} ({prediction.probabilityPct}% prob ·{' '}
                      {prediction.estimatedFailureWindow})
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {prediction.recommendedAction}
                    </p>
                  </div>
                )}
              </div>
              <div className="lg:col-span-7">
                <AssetAiTimelinePanel assetLabel={targetId} stages={timeline} compact />
              </div>
            </div>
          );
        })()}

        {/* Resolution & Governance Report Handoff */}
        {(() => {
          const linkedDec = decisions.find(
            (d) =>
              d.incidentId === activeRootCauseAnalysis.incidentId ||
              d.faultId === activeRootCauseAnalysis.faultId ||
              d.targetAssetId === activeRootCauseAnalysis.canonicalAssetId
          );
          const linkedTask = linkedDec
            ? fieldTasks.find((t) => t.id === linkedDec.assignedTaskId || t.decisionId === linkedDec.id)
            : fieldTasks.find((t) => t.assetId === activeRootCauseAnalysis.canonicalAssetId);
          return (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Governance Link:</span>
                {linkedDec ? (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
                    {linkedDec.decisionCode} · {linkedDec.status}
                  </span>
                ) : (
                  <span className="text-slate-500">No decision submitted yet</span>
                )}
                {linkedTask && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                    {linkedTask.taskCode} · {linkedTask.status}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openFieldTaskForAsset(activeRootCauseAnalysis.canonicalAssetId)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Wrench className="w-3 h-3 text-amber-500" />
                  <span>Field Task</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('decisions')}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileCheck2 className="w-3 h-3 text-cyan-500" />
                  <span>Sim Approvals</span>
                </button>
                {linkedDec && (
                  <button
                    type="button"
                    onClick={() => {
                      const fault = faults.find((f) => f.id === linkedDec.faultId);
                      const inc = scopedReconstructions.find((r) => r.id === linkedDec.incidentId);
                      const scen = scenarios.find(
                        (s) => s.id === linkedDec.evidenceBundle.simulationScenarioId
                      );
                      const ev = fieldEvidence.filter(
                        (e) =>
                          e.decisionId === linkedDec.id || (linkedTask && e.taskId === linkedTask.id)
                      );
                      exportIncidentResolutionPdf({
                        decision: linkedDec,
                        fault,
                        incident: inc,
                        scenario: scen,
                        task: linkedTask || null,
                        evidence: ev,
                        assets
                      });
                      recordResolutionReportExportAudit(linkedDec);
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 border border-slate-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-cyan-400" />
                    <span>Resolution PDF</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Operational Event Provenance Stream */}
      {scopedEvents.some((e) => e.hasContradiction) && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-bold font-mono uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>Timestamp Contradiction Flagged</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            One or more field reports disagree with telemetry measurements. Review flagged timeline entries before authorizing switching actions.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
              Raw Telemetry &amp; Field Event Stream · {geoScopeLabel}
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredEvents.length} Event(s)
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs w-full sm:w-auto min-h-[44px] lg:min-h-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 pr-2 py-0.5 text-xs focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL">All Source Records</option>
              <option value="SCADA_OSI">SCADA / Telemetry</option>
              <option value="LINEWORKER_RADIO">Lineworker Notes</option>
              <option value="OMS_ORACLE">OMS Tickets</option>
              <option value="WEATHER_RADAR">Weather Radar</option>
            </select>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No operational events recorded for the current filter scope.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {filteredEvents.map((evt) => {
              const isContradiction = evt.hasContradiction;
              const isInferred = evt.isInferred;
              const isSelected = selectedEventId === evt.id;

              return (
                <div
                  key={evt.id}
                  onClick={() => {
                    setSelectedEventId(evt.id === selectedEventId ? null : evt.id);
                    selectAsset(evt.assetCanonicalId, 'events', { zoom: 15, openPopup: false });
                  }}
                  className={`relative group cursor-pointer transition-all ${
                    isSelected ? 'scale-[1.01]' : ''
                  }`}
                >
                  <div
                    className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-slate-900 transition-colors ${
                      isContradiction
                        ? 'border-rose-500 bg-rose-500/20'
                        : isInferred
                          ? 'border-indigo-500 bg-indigo-500/20'
                          : 'border-cyan-500 bg-cyan-500/20'
                    }`}
                  />

                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      isContradiction
                        ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/20'
                        : isSelected
                          ? 'border-cyan-500 dark:border-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/20 ring-1 ring-cyan-500'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {evt.timestamp.replace('T', ' ').slice(0, 19)} UTC
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getSourceBadgeColor(
                            evt.sourceSystem
                          )}`}
                        >
                          {evt.sourceSystem}
                        </span>
                        <SourceBadge source={evt.telemetrySource ?? evt.source} compact />
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-slate-400">Asset: {evt.assetCanonicalId}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            focusAssetOnMap(evt.assetCanonicalId);
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-600/20 flex items-center gap-1 cursor-pointer"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Map</span>
                        </button>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                      {evt.eventType.replace(/_/g, ' ')} · {formatMissingValue(evt.assetName)}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {evt.summary}
                    </p>

                    {isContradiction && evt.contradictionDetail && (
                      <div className="mt-3 p-3 bg-rose-100/60 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-200">
                        <strong>Audit Discrepancy Note:</strong> {evt.contradictionDetail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
