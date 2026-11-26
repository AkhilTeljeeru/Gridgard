import React from 'react';
import { Eye, HeartPulse, MapPin, Clock } from 'lucide-react';
import { ResponsiveDrawer } from './ResponsiveDrawer';

export interface MobileRecordField {
  label: string;
  value: React.ReactNode;
}

export interface MobileRecordItem {
  id: string;
  assetName: string;
  assetId: string;
  status: string;
  statusTone?: 'critical' | 'warning' | 'healthy' | 'info' | 'neutral';
  health: string;
  location: string;
  lastUpdated: string;
  summary?: string;
  detailFields?: MobileRecordField[];
  actions?: React.ReactNode;
}

interface MobileRecordCardListProps {
  items: MobileRecordItem[];
  emptyText?: string;
  detailTitle?: string;
  onInspectAsset?: (assetId: string) => void;
}

export const getStatusBadgeClasses = (tone: MobileRecordItem['statusTone'] = 'neutral') => {
  switch (tone) {
    case 'critical':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
    case 'warning':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    case 'healthy':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    case 'info':
      return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30';
    default:
      return 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
  }
};

export const MobileRecordCardList: React.FC<MobileRecordCardListProps> = ({
  items,
  emptyText = 'No records match the current scope.',
  detailTitle = 'Record Details',
  onInspectAsset
}) => {
  const [selectedItem, setSelectedItem] = React.useState<MobileRecordItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="md:hidden p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        {emptyText}
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {item.assetName}
                </div>
                <div className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 mt-0.5 truncate">
                  {item.assetId}
                </div>
              </div>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border shrink-0 uppercase ${getStatusBadgeClasses(
                  item.statusTone
                )}`}
              >
                {item.status}
              </span>
            </div>

            {item.summary && (
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                {item.summary}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-slate-400">Health:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {item.health}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                <span className="truncate">{item.location}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono truncate tabular-nums">{item.lastUpdated}</span>
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedItem(item)}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <Eye className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>View Details</span>
              </button>
              {onInspectAsset && item.assetId && (
                <button
                  type="button"
                  onClick={() => onInspectAsset(item.assetId)}
                  className="min-h-[44px] px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  Open Asset
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ResponsiveDrawer
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.assetName || detailTitle}
        subtitle={selectedItem ? `${selectedItem.assetId} · ${selectedItem.location}` : undefined}
        variant="bottom"
        footer={
          selectedItem?.actions ? (
            <div className="flex flex-wrap items-center gap-2" onClick={() => setSelectedItem(null)}>
              {selectedItem.actions}
            </div>
          ) : undefined
        }
      >
        {selectedItem && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Operational Status
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedItem.status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Asset Health
                </div>
                <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                  {selectedItem.health}
                </div>
              </div>
            </div>

            {selectedItem.summary && (
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {selectedItem.summary}
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Asset ID</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {selectedItem.assetId}
                </span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Location</span>
                <span className="text-right text-slate-900 dark:text-white">
                  {selectedItem.location}
                </span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Last Updated</span>
                <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                  {selectedItem.lastUpdated}
                </span>
              </div>
              {selectedItem.detailFields?.map((field, idx) => (
                <div
                  key={`${field.label}-${idx}`}
                  className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">{field.label}</span>
                  <span className="text-right text-slate-900 dark:text-white font-medium break-words">
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ResponsiveDrawer>
    </>
  );
};
