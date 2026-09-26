import React, { useState } from 'react';
import { Download, ShieldOff, AlertTriangle, X, Loader2 } from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { Button, Input, Label, ErrorMessage, SuccessMessage } from './UIComponents';

/**
 * Actioning a person's data request against their account.
 *
 * Shown only to a coordinator, on a person they have opened. Export is
 * routine; erasure is not, so it states plainly what will and will not be
 * removed before it asks for anything, rather than after.
 */

interface DataRequestPanelProps {
  user: { id: string | number; first_name?: string; last_name?: string; email?: string };
  onErased?: () => void;
}

const DataRequestPanel: React.FC<DataRequestPanelProps> = ({ user, onErased }) => {
  const [busy, setBusy] = useState<'export' | 'erase' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');

  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'this account';

  const runExport = async () => {
    setBusy('export'); setError(null); setNotice(null);
    try {
      const data = await DatabaseConnection.exportUserData(user.id);
      // A JSON file rather than a CSV: this is nested - an account, shifts,
      // reviews, audit entries - and flattening it would lose the shape a
      // subject access request is supposed to show.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('Export downloaded.');
    } catch (err: any) {
      setError(err?.message || 'Could not build the export.');
    } finally { setBusy(null); }
  };

  const runErase = async () => {
    setBusy('erase'); setError(null); setNotice(null);
    try {
      const result = await DatabaseConnection.eraseUserData(user.id, typedEmail.trim());
      setNotice(
        `Personal data erased. ${result?.erased?.field_records_observer_replaced ?? 0} field ` +
        `${(result?.erased?.field_records_observer_replaced ?? 0) === 1 ? 'record' : 'records'} kept with the observer removed.`
      );
      setConfirming(false);
      setTypedEmail('');
      onErased?.();
    } catch (err: any) {
      setError(err?.message || 'Could not erase this account.');
    } finally { setBusy(null); }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Data requests</p>

      {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}
      {notice && <SuccessMessage className="mb-3">{notice}</SuccessMessage>}

      {!confirming ? (
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={runExport} disabled={busy !== null}
                  icon={busy === 'export' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}>
            Export their data
          </Button>
          <Button variant="outline" onClick={() => { setConfirming(true); setError(null); setNotice(null); }}
                  disabled={busy !== null}
                  className="border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
                  icon={<ShieldOff className="size-4" />}>
            Erase personal data
          </Button>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="size-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Erase {name}'s personal data</p>
              {/* Said before asking for the confirmation, not after: the point
                  is to be sure this is what was intended. */}
              <ul className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                <li><span className="font-bold">Removed:</span> name, email, profile picture, station, and their future shifts. The account can no longer be signed into.</li>
                <li><span className="font-bold">Kept:</span> the nests, surveys and turtle encounters they recorded — these describe animals, not people — with their name replaced wherever it appears as observer.</li>
                <li>The audit trail keeps what happened and when, without their email.</li>
              </ul>
              <p className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400">This cannot be undone.</p>
            </div>
          </div>

          <Label htmlFor="confirm-erase-email">Type <span className="font-mono">{user.email}</span> to confirm</Label>
          <Input
            id="confirm-erase-email"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            placeholder={user.email}
            autoComplete="off"
          />

          <div className="flex gap-2 mt-3">
            <Button
              onClick={runErase}
              disabled={busy !== null || typedEmail.trim().toLowerCase() !== String(user.email || '').trim().toLowerCase()}
              className="bg-rose-600 hover:bg-rose-700"
              icon={busy === 'erase' ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
            >
              Erase permanently
            </Button>
            <Button variant="outline" onClick={() => { setConfirming(false); setTypedEmail(''); }}
                    disabled={busy !== null} icon={<X className="size-4" />}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataRequestPanel;
