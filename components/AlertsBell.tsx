import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import type { AppAlert } from '../types';
import { timeAgo } from '../lib/timeAgo';

/**
 * The bell in the header: what needs this person's attention right now.
 *
 * A leader sees what is waiting for review; whoever recorded something sees
 * when it was approved or sent back. The server works out which, so this only
 * displays and clears them. A pending review clears when it is decided, so it
 * has no button; a decision on your own record is cleared with "Got it", and
 * that clears it for everyone.
 */

interface AlertsBellProps {
  /** Re-read on change, so navigating (e.g. after deciding a review) refreshes the count. */
  refreshKey?: unknown;
  /** Opens the review screen. */
  onOpenReviews: () => void;
}

const POLL_MS = 60_000;

const ICONS: Record<AppAlert['kind'], React.ReactNode> = {
  review_pending: <ClipboardCheck className="size-4 text-violet-500" />,
  review_rejected: <AlertCircle className="size-4 text-rose-500" />,
  review_approved: <CheckCircle2 className="size-4 text-emerald-500" />,
};

const AlertsBell: React.FC<AlertsBellProps> = ({ refreshKey, onOpenReviews }) => {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setAlerts(await DatabaseConnection.getAlerts());
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    const timer = setInterval(load, POLL_MS);
    window.addEventListener('focus', load);
    return () => { clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const acknowledge = async (alert: AppAlert) => {
    setError(null);
    setBusyId(alert.id);
    try {
      await DatabaseConnection.acknowledgeAlert(alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (err: any) {
      setError(err?.message || 'Could not clear that alert.');
      load();
    } finally {
      setBusyId(null);
    }
  };

  const count = alerts.length;
  const label = count > 0 ? `Alerts, ${count} need attention` : 'Alerts, none';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/10"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Alerts"
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-[70] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Alerts</p>
          </div>

          {error && <p role="alert" className="px-4 py-2 text-xs font-bold text-rose-500">{error}</p>}

          {count === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-slate-500">You're all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
              {alerts.map((alert) => (
                <li key={alert.id} className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">{ICONS[alert.kind]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{alert.title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 break-words">{alert.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {alert.at && (
                          <span className="text-[11px] text-slate-400">{timeAgo(new Date(alert.at))}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => { setOpen(false); onOpenReviews(); }}
                          className="text-[11px] font-bold text-primary hover:underline"
                        >
                          {alert.kind === 'review_pending' ? 'Review it' : 'View'}
                        </button>
                        {alert.can_acknowledge && (
                          <button
                            type="button"
                            onClick={() => acknowledge(alert)}
                            disabled={busyId === alert.id}
                            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                          >
                            <Check className="size-3" />
                            Got it
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsBell;
