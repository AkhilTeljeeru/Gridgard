import React from 'react';
import type { AssetSource } from '../../types/grid';

interface SourceBadgeProps {
  source: AssetSource;
  compact?: boolean;
}

const SOURCE_STYLES: Record<AssetSource, string> = {
  DEMO: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35',
  OSM: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/35',
  SIMULATED: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35',
  UTILITY: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, compact = false }) => {
  return (
    <span
      title={`Data Source: ${source}`}
      className={`inline-flex items-center font-mono font-bold uppercase border rounded ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      } ${SOURCE_STYLES[source]}`}
    >
      {source}
    </span>
  );
};
