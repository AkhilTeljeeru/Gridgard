import React, { useState } from 'react';
import { useGrid } from '../../context/GridContext';
import { SourceBadge } from '../ui/SourceBadge';
import type { WorkflowStageId } from '../../types/grid';
import {
  AlertTriangle,
  MapPin,
  Network,
  Clock,
  SearchCheck,
  Cpu,
  FileCheck2,
  ScrollText,
  ChevronRight,
  ChevronDown,
  Wrench
} from 'lucide-react';

interface PipelineStage {
  id: WorkflowStageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { id: 'incident', label: 'Incident Detected', icon: AlertTriangle },
  { id: 'map', label: 'Grid Map', icon: MapPin },
  { id: 'graph', label: 'Knowledge Graph', icon: Network },
  { id: 'events', label: 'Event Reconstruction', icon: Clock },
  { id: 'rca', label: 'Root Cause Analysis', icon: SearchCheck },
  { id: 'simulator', label: 'What-If Simulator', icon: Cpu },
  { id: 'decisions', label: 'Decisions & Approval', icon: FileCheck2 },
  { id: 'field', label: 'Field Execution', icon: Wrench },
  { id: 'audit', label: 'Audit Log', icon: ScrollText }
];

export const InvestigationPipelineBar: React.FC = () => {
  const {
    activeWorkflowStage,
    navigateWorkflowStage,
    selectedAssetId,
    activeRootCauseAnalysis
  } = useGrid();

  const [mobileExpanded, setMobileExpanded] = useState(false);

  const activeAssetLabel =
    selectedAssetId || activeRootCauseAnalysis.canonicalAssetId || 'SUB-TG-06U';
  const activeStageObj =
    PIPELINE_STAGES.find((s) => s.id === activeWorkflowStage) || PIPELINE_STAGES[0];
  const ActiveStageIcon = activeStageObj.icon;

  return (
    <div className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-900/80 px-3 sm:px-4 md:px-6 py-1.5 md:py-2 shrink-0 z-20 relative">
      {/* Mobile Compact Single-Line Strip (< md) */}
      <div className="flex md:hidden items-center justify-between gap-2 min-h-[32px]">
        <div className="flex items-center gap-1.5 min-w-0 text-[11px] font-mono">
          <span className="font-bold text-cyan-700 dark:text-cyan-400 truncate max-w-[115px]">
            {activeAssetLabel}
          </span>
          <SourceBadge source={activeRootCauseAnalysis.source} compact />
          {activeRootCauseAnalysis.faultId && (
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold truncate max-w-[70px]">
              · {activeRootCauseAnalysis.faultId}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          aria-expanded={mobileExpanded}
          className="px-2.5 py-1 rounded-md bg-cyan-600 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <ActiveStageIcon className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[115px]">{activeStageObj.label}</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Mobile Expandable Workflow Grid */}
      {mobileExpanded && (
        <div className="md:hidden mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1.5 pb-1">
          {PIPELINE_STAGES.map((stage) => {
            const Icon = stage.icon;
            const isActive = activeWorkflowStage === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  navigateWorkflowStage(stage.id);
                  setMobileExpanded(false);
                }}
                className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 text-left cursor-pointer ${
                  isActive
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{stage.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Tablet / Desktop Full Horizontal Workflow Bar (>= md) */}
      <div className="hidden md:flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
        {/* Active Context Summary */}
        <div className="flex items-center gap-2 min-w-0 shrink-0 text-xs font-mono">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
            Active Thread:
          </span>
          <span className="font-bold text-cyan-700 dark:text-cyan-400 truncate max-w-[160px]">
            {activeAssetLabel}
          </span>
          <SourceBadge source={activeRootCauseAnalysis.source} compact />
          {activeRootCauseAnalysis.faultId && (
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
              · {activeRootCauseAnalysis.faultId}
            </span>
          )}
        </div>

        {/* 9-Stage Connected Operational Workflow */}
        <nav
          aria-label="Operational Investigation Workflow"
          className="flex items-center gap-0.5 overflow-x-auto no-scrollbar py-0.5"
        >
          {PIPELINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isActive = activeWorkflowStage === stage.id;
            const activeStageIdx = PIPELINE_STAGES.findIndex((s) => s.id === activeWorkflowStage);
            const isCompleted = activeStageIdx > idx;

            return (
              <React.Fragment key={stage.id}>
                <button
                  type="button"
                  onClick={() => navigateWorkflowStage(stage.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                      : isCompleted
                        ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span>{stage.label}</span>
                </button>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <ChevronRight
                    className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

