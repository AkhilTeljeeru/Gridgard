import React from 'react';
import { useGrid } from '../../context/GridContext';
import { AlertTriangle, CheckCircle2, Info, MapPin, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast, focusAssetOnMap, setActiveView } = useGrid();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      {toasts.map((toast) => {
        const isCritical = toast.severity === 'CRITICAL';
        const isHigh = toast.severity === 'HIGH' || toast.severity === 'MEDIUM';
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-xl transition-all ${
              isCritical
                ? 'border-rose-500/50'
                : isHigh
                  ? 'border-amber-500/50'
                  : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                {isCritical ? (
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                ) : isHigh ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                ) : toast.title.includes('Exported') ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {toast.title}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                    {toast.message}
                  </p>
                  <div className="flex items-center gap-3 pt-0.5">
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {toast.timestamp.slice(11, 19)} UTC
                    </span>
                    {toast.relatedAssetId && (
                      <button
                        type="button"
                        onClick={() => {
                          focusAssetOnMap(toast.relatedAssetId!);
                          dismissToast(toast.id);
                        }}
                        className="text-[11px] font-mono font-semibold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Locate</span>
                      </button>
                    )}
                    {!toast.relatedAssetId && toast.targetView && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView(toast.targetView!);
                          dismissToast(toast.id);
                        }}
                        className="text-[11px] font-mono font-semibold text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Open</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification toast"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
