import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, X, Play } from 'lucide-react';
import { DatabaseConnection, ShiftData, RosterTemplate, RosterTemplateApplyResult } from '../services/Database';

/**
 * A named, reusable weekly pattern - day of week, shift, volunteer - a
 * coordinator builds once and applies to a real week instead of re-entering
 * the same names every time.
 *
 * The day picker shows Monday first, matching the week view this opens from;
 * the API's day_of_week is Sunday(0)-Saturday(6), so DAY_OPTIONS carries both.
 */

interface RosterTemplatesModalProps {
  theme: 'light' | 'dark';
  shifts: ShiftData[];
  volunteers: { id?: number | string; name: string }[];
  /** The Monday currently open on the timetable, offered as the apply target. */
  defaultMonday: string;
  onClose: () => void;
  /** Called after a successful apply, so the caller can refresh the week view. */
  onApplied: () => void;
}

const DAY_OPTIONS: { label: string; day_of_week: number }[] = [
  { label: 'Monday', day_of_week: 1 },
  { label: 'Tuesday', day_of_week: 2 },
  { label: 'Wednesday', day_of_week: 3 },
  { label: 'Thursday', day_of_week: 4 },
  { label: 'Friday', day_of_week: 5 },
  { label: 'Saturday', day_of_week: 6 },
  { label: 'Sunday', day_of_week: 0 },
];
interface RowDraft {
  day_of_week: number;
  shift_id: number | '';
  user_id: number | '';
}

const emptyRow = (): RowDraft => ({ day_of_week: 1, shift_id: '', user_id: '' });

const RosterTemplatesModal: React.FC<RosterTemplatesModalProps> = ({ theme, shifts, volunteers, defaultMonday, onClose, onApplied }) => {
  const [templates, setTemplates] = useState<RosterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The template being built or edited, or null when only the list shows.
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftRows, setDraftRows] = useState<RowDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [applyMonday, setApplyMonday] = useState(defaultMonday);
  const [applyResult, setApplyResult] = useState<RosterTemplateApplyResult | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTemplates(await DatabaseConnection.getRosterTemplates());
    } catch (err: any) {
      setError(err?.message || 'Could not load roster templates.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const startNew = () => {
    setEditingId('new');
    setDraftName('');
    setDraftRows([emptyRow()]);
    setError(null);
  };

  const startEdit = (t: RosterTemplate) => {
    setEditingId(t.id);
    setDraftName(t.name);
    setDraftRows(t.rows.map((r) => ({ day_of_week: r.day_of_week, shift_id: r.shift_id, user_id: r.user_id })));
    setError(null);
  };

  const cancelEdit = () => { setEditingId(null); setDraftName(''); setDraftRows([]); };

  const updateRow = (index: number, changes: Partial<RowDraft>) =>
    setDraftRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...changes } : r)));

  const saveTemplate = async () => {
    setError(null);
    const name = draftName.trim();
    if (!name) { setError('The template needs a name.'); return; }
    const rows = draftRows.filter((r) => r.shift_id !== '' && r.user_id !== '');
    if (rows.length === 0) { setError('Add at least one complete row (day, shift and volunteer).'); return; }

    setIsSaving(true);
    try {
      const payload = rows as { day_of_week: number; shift_id: number; user_id: number }[];
      if (editingId === 'new') {
        await DatabaseConnection.createRosterTemplate(name, payload);
        flash('Template created.');
      } else if (typeof editingId === 'number') {
        await DatabaseConnection.updateRosterTemplate(editingId, name, payload);
        flash('Template updated.');
      }
      cancelEdit();
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save the template.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (t: RosterTemplate) => {
    if (!window.confirm(`Delete "${t.name}"? This does not undo any week it was already applied to.`)) return;
    setError(null);
    try {
      await DatabaseConnection.deleteRosterTemplate(t.id);
      flash(`${t.name} deleted.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not delete the template.');
    }
  };

  const openApply = (t: RosterTemplate) => {
    setApplyingId(t.id);
    setApplyMonday(defaultMonday);
    setApplyResult(null);
    setError(null);
  };

  const runApply = async () => {
    if (applyingId === null) return;
    setError(null);
    try {
      const result = await DatabaseConnection.applyRosterTemplate(applyingId, applyMonday);
      setApplyResult(result);
      if (result.created.length > 0) onApplied();
    } catch (err: any) {
      setError(err?.message || 'Could not apply the template.');
    }
  };

  const cardCls = `rounded-xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`;
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm outline-none ${theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-white border-slate-200 text-slate-900'}`;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label="Roster templates">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${theme === 'dark' ? 'bg-background-dark border border-border-dark' : 'bg-white border border-slate-200'}`}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black uppercase tracking-tight">Roster Templates</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="size-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Save the volunteers who cover each day and shift, then apply it to any week in one go.
          Applying skips anyone who already has something that day, so it is safe to apply twice.
        </p>

        {notice && <p role="status" className="mb-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">{notice}</p>}
        {error && <p role="alert" className="mb-3 text-sm font-bold text-rose-500">{error}</p>}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            {templates.length === 0 && editingId === null && (
              <p className="text-sm text-slate-500 mb-4">No templates yet.</p>
            )}

            <ul className="space-y-3 mb-4">
              {templates.map((t) => (
                <li key={t.id} className={cardCls}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.rows.length} row{t.rows.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openApply(t)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1.5">
                        <Play className="size-3.5" /> Apply
                      </button>
                      <button onClick={() => startEdit(t)} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold">
                        Edit
                      </button>
                      <button onClick={() => deleteTemplate(t)} aria-label={`Delete ${t.name}`} className="p-2 text-slate-400 hover:text-rose-500">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {applyingId === t.id && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                      {applyResult ? (
                        <div className="text-sm space-y-1">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            {applyResult.created.length} shift{applyResult.created.length === 1 ? '' : 's'} added.
                          </p>
                          {applyResult.skipped.length > 0 && (
                            <p className="text-slate-500">
                              {applyResult.skipped.length} skipped - already had something that day: {' '}
                              {applyResult.skipped.map((s) => `${s.user} (${s.date})`).join(', ')}.
                            </p>
                          )}
                          <button onClick={() => setApplyingId(null)} className="mt-1 text-xs font-bold text-primary hover:underline">Done</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-500" htmlFor="apply-monday">Week of</label>
                          <input id="apply-monday" type="date" value={applyMonday} onChange={(e) => setApplyMonday(e.target.value)} className={inputCls + ' w-auto'} />
                          <button onClick={runApply} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">Confirm</button>
                          <button onClick={() => setApplyingId(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500">Cancel</button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {editingId === null ? (
              <button onClick={startNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-500/10">
                <Plus className="size-4" /> New template
              </button>
            ) : (
              <div className={cardCls}>
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1" htmlFor="template-name">Name</label>
                  <input id="template-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Standard week" className={inputCls} />
                </div>

                <ul className="space-y-2 mb-3">
                  {draftRows.map((row, i) => (
                    <li key={i} className="grid grid-cols-1 sm:grid-cols-[7rem_1fr_1fr_auto] gap-2 items-center">
                      <select aria-label="Day" value={row.day_of_week} onChange={(e) => updateRow(i, { day_of_week: Number(e.target.value) })} className={inputCls}>
                        {DAY_OPTIONS.map((d) => <option key={d.day_of_week} value={d.day_of_week}>{d.label}</option>)}
                      </select>
                      <select aria-label="Shift" value={row.shift_id} onChange={(e) => updateRow(i, { shift_id: e.target.value ? Number(e.target.value) : '' })} className={inputCls}>
                        <option value="">Select shift…</option>
                        {shifts.filter((s) => s.is_active !== false).map((s) => <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>)}
                      </select>
                      <select aria-label="Volunteer" value={row.user_id} onChange={(e) => updateRow(i, { user_id: e.target.value ? Number(e.target.value) : '' })} className={inputCls}>
                        <option value="">Select volunteer…</option>
                        {volunteers.filter((v) => v.id != null).map((v) => <option key={String(v.id)} value={v.id}>{v.name}</option>)}
                      </select>
                      <button
                        onClick={() => setDraftRows((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove row ${i + 1}`}
                        className="p-2 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setDraftRows((prev) => [...prev, emptyRow()])} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold">
                    <Plus className="size-3.5" /> Add row
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500">Cancel</button>
                    <button onClick={saveTemplate} disabled={isSaving} className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50">
                      {isSaving ? 'Saving…' : 'Save template'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RosterTemplatesModal;
