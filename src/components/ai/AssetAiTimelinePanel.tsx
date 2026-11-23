import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Sparkles,
  Wrench
} from 'lucide-react';
import type { AssetTimelineStage } from '../../types/grid';

interface AssetAiTimelinePanelProps {
  assetLabel: string;
  stages: AssetTimelineStage[];
  compact?: boolean;
}

export const AssetAiTimelinePanel: React.FC<AssetAiTimelinePanelProps> = ({
  assetLabel,
  stages,
  compact = false
}) => {
  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        Select a canonical asset to inspect its 7-stage AI lifecycle &amp; risk timeline.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Asset AI Lifecycle Timeline
        </span>
        <span className="truncate text-xs font-mono text-slate-600 dark:text-slate-300">
          {assetLabel}
        </span>
      </div>

      <ol className="space-y-2">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          const icon =
            stage.status === 'CRITICAL' ? (
              <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            ) : stage.status === 'WARNING' ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            ) : stage.status === 'FUTURE' ? (
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            ) : stage.stage === 'ROUTINE_MAINTENANCE' || stage.stage === 'REPAIR' ? (
              <Wrench className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            );

          const statusColor =
            stage.status === 'CRITICAL'
              ? 'text-red-600 dark:text-red-400'
              : stage.status === 'WARNING'
                ? 'text-amber-600 dark:text-amber-400'
                : stage.status === 'FUTURE'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-emerald-600 dark:text-emerald-400';

          return (
            <li key={stage.stage} className="relative flex gap-2.5">
              <div className="flex flex-col items-center pt-0.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  {icon}
                </span>
                {!isLast && (
                  <span className="mt-1 h-full w-px bg-slate-200 dark:bg-slate-800" />
                )}
              </div>

              <div
                className={`min-w-0 flex-1 rounded-lg border border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60 ${
                  compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {idx + 1}. {stage.label}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {stage.timestamp}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className={`font-semibold ${statusColor}`}>{stage.status}</span>
                  </div>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {stage.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
