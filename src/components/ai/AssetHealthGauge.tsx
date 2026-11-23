import React from 'react';
import type { AssetHealthScore } from '../../types/grid';

interface AssetHealthGaugeProps {
  health: AssetHealthScore;
  compact?: boolean;
  showFactors?: boolean;
}

export const AssetHealthGauge: React.FC<AssetHealthGaugeProps> = ({
  health,
  compact = false,
  showFactors = false
}) => {
  const score = Math.max(0, Math.min(100, Math.round(health.healthScore)));
  const radius = compact ? 30 : 42;
  const strokeWidth = compact ? 6 : 8;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  const strokeColor =
    health.category === 'CRITICAL'
      ? '#ef4444'
      : health.category === 'WARNING'
        ? '#f59e0b'
        : '#10b981';

  const textColorClass =
    health.category === 'CRITICAL'
      ? 'text-red-600 dark:text-red-400'
      : health.category === 'WARNING'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';

  const svgWidth = compact ? 76 : 108;
  const svgHeight = compact ? 44 : 62;
  const cx = svgWidth / 2;
  const cy = svgHeight - 4;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: svgWidth, height: svgHeight }}>
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            aria-label={`Health score ${score} out of 100`}
          >
            <path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center leading-none">
            <span
              className={`font-bold tabular-nums ${
                compact ? 'text-base' : 'text-xl'
              } ${textColorClass}`}
            >
              {score}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs font-semibold uppercase tracking-wide ${textColorClass}`}>
              {health.category}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {score}/100 Index
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-800 dark:text-slate-200">
            {health.assetName} ({health.assetId})
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Load {health.peakLoadPct}% · {health.historicalFaultCount} faults ·{' '}
            {health.maintenanceOverdueDays}d overdue
          </p>
        </div>
      </div>

      {showFactors && health.factors.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 pt-2.5 dark:border-slate-800">
          {health.factors.map((f) => {
            const penalty = Math.abs(f.impactPoints);
            const barColor =
              penalty >= 18
                ? 'bg-red-500'
                : penalty >= 10
                  ? 'bg-amber-500'
                  : 'bg-emerald-500';
            const fillPct = Math.min(100, Math.max(8, Math.round((penalty / 32) * 100)));
            return (
              <div key={f.factor} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{f.factor}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {f.impactPoints < 0 ? `${f.impactPoints} pts` : 'Nominal'}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${fillPct}%` }} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{f.observation}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
