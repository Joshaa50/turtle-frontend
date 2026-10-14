import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X, Loader2 } from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { Button, Input, Label, ErrorMessage, SuccessMessage } from './UIComponents';

/**
 * Wipes every nest/turtle/emergence/review/audit entry/timetable assignment/
 * roster template and every user except the 4 demo personas, then lets the
 * server reseed fresh, realistic data in the background.
 *
 * Shown only to a real (non-demo) coordinator - see ProjectSettings.tsx's
 * isRealCoordinator gate. This is a maintenance tool, not something a real
 * organisation's coordinator should ever need to use day to day.
 */

const CONFIRM_PHRASE = 'RESET DEMO DATA';

const ResetDemoDataPanel: React.FC = () => {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await DatabaseConnection.resetDemoData(typed.trim());
      setNotice(result?.message || 'Demo data wiped. Regenerating fresh data in the background.');
      setConfirming(false);
      setTyped('');
    } catch (err: any) {
      setError(err?.message || 'Could not reset demo data.');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">
        Wipes every nest, turtle, emergence, review, audit entry, timetable assignment and
        roster template, and deletes every user account except the 4 demo personas. Beaches,
        shift types and project settings are kept. This is a maintenance tool, not something a
        real organisation's coordinator should ever need.
      </p>

      {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}
      {notice && <SuccessMessage className="mb-3">{notice}</SuccessMessage>}

      {!confirming ? (
        <Button
          variant="outline"
          onClick={() => { setConfirming(true); setError(null); setNotice(null); }}
          className="border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
          icon={<RotateCcw className="size-4" />}
        >
          Reset demo data
        </Button>
      ) : (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="size-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Reset all demo data</p>
              <p className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                This deletes every nest, turtle, emergence, review and user account except the 4
                demo personas. This cannot be undone.
              </p>
            </div>
          </div>

          <Label htmlFor="confirm-reset-phrase">Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm</Label>
          <Input
            id="confirm-reset-phrase"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
          />

          <div className="flex gap-2 mt-3">
            <Button
              onClick={run}
              disabled={busy || typed.trim() !== CONFIRM_PHRASE}
              className="bg-rose-600 hover:bg-rose-700"
              icon={busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            >
              Reset permanently
            </Button>
            <Button variant="outline" onClick={() => { setConfirming(false); setTyped(''); }}
                    disabled={busy} icon={<X className="size-4" />}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResetDemoDataPanel;
