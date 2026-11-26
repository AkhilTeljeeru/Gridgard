import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ResponsiveDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  variant?: 'bottom' | 'right' | 'left' | 'modal';
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export const ResponsiveDrawer: React.FC<ResponsiveDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  variant = 'bottom',
  children,
  footer,
  maxWidthClass = 'max-w-lg'
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const containerClass =
    variant === 'bottom'
      ? 'fixed inset-x-0 bottom-0 z-50 w-full max-h-[85dvh] rounded-t-2xl border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-200'
      : variant === 'right'
        ? 'fixed inset-y-0 right-0 z-50 w-[min(92vw,400px)] border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col'
        : variant === 'left'
          ? 'fixed inset-y-0 left-0 z-50 w-[min(92vw,360px)] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col'
          : `relative z-50 w-[calc(100vw-1.5rem)] ${maxWidthClass} max-h-[90dvh] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden`;

  return (
    <div
      className={`fixed inset-0 z-50 ${
        variant === 'modal' ? 'flex items-center justify-center p-3' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={containerClass}>
        {variant === 'bottom' && (
          <div className="pt-2 pb-1 flex justify-center shrink-0" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
        )}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="min-h-[44px] min-w-[44px] -mr-2 -my-1.5 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">{children}</div>

        {footer && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
