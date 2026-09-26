import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPinned, Plus, RefreshCw, Pencil, EyeOff, Eye, AlertCircle, X } from 'lucide-react';
import { DatabaseConnection, Beach } from '../services/Database';
import { User } from '../types';
import { Button, Input, Label, ErrorMessage, SuccessMessage, HelperText } from '../components/UIComponents';

/**
 * The beaches this organisation surveys.
 *
 * Until this existed the site list was fixed rows in the database, loaded once
 * for one project, so adopting the app meant asking its developer to insert
 * your beaches by hand. Everything downstream keys off this list: the survey's
 * beach chips, the nest form's required Beach field, and the code that
 * prefixes every nest recorded there.
 */

interface SiteManagementProps {
  user: User;
  theme?: 'light' | 'dark';
  /** Lets App refresh the beach list the rest of the app is holding. */
  onBeachesChanged?: () => void;
}

const isManager = (role: string) => role === 'Field Leader' || role.includes('Coordinator');

type Draft = { id?: number; name: string; code: string; station: string; survey_area: string };
const emptyDraft: Draft = { name: '', code: '', station: '', survey_area: '' };

const SiteManagement: React.FC<SiteManagementProps> = ({ user, onBeachesChanged }) => {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [groupings, setGroupings] = useState<{ stations: string[]; survey_areas: string[] }>({
    stations: [],
    survey_areas: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const canManage = isManager(user.role);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [list, groups] = await Promise.all([
      DatabaseConnection.getBeaches(),
      DatabaseConnection.getBeachGroupings(),
    ]);
    setBeaches(list);
    setGroupings(groups);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => beaches.filter((b) => (showRetired ? true : b.is_active !== false)),
    [beaches, showRetired]
  );

  const retiredCount = useMemo(
    () => beaches.filter((b) => b.is_active === false).length,
    [beaches]
  );

  const byArea = useMemo(() => {
    const groups: Record<string, Beach[]> = {};
    for (const b of visible) (groups[b.survey_area || 'Unassigned'] ||= []).push(b);
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const save = async () => {
    if (!draft) return;
    setError(null);
    try {
      if (draft.id) {
        await DatabaseConnection.updateBeach(draft.id, {
          name: draft.name, code: draft.code, station: draft.station, survey_area: draft.survey_area,
        });
        flash(`${draft.name} updated.`);
      } else {
        await DatabaseConnection.createBeach({
          name: draft.name, code: draft.code, station: draft.station, survey_area: draft.survey_area,
        });
        flash(`${draft.name} added. It is now available in surveys and nest entry.`);
      }
      setDraft(null);
      await load();
      onBeachesChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Could not save that beach.');
    }
  };

  const setRetired = async (beach: Beach, retired: boolean) => {
    setError(null);
    setBusyId(beach.id);
    try {
      await DatabaseConnection.updateBeach(beach.id, { is_active: !retired });
      flash(retired
        ? `${beach.name} retired. Records made there are unchanged.`
        : `${beach.name} is back in use.`);
      await load();
      onBeachesChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Could not update that beach.');
    } finally {
      setBusyId(null);
    }
  };

  if (!canManage) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <p className="text-sm text-slate-500">
          Only a project coordinator or field leader can manage the beach list.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <MapPinned className="size-6 text-primary shrink-0" />
          <h2 className="text-xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Beaches</h2>
          <button
            onClick={load}
            disabled={isLoading}
            className="ml-auto p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/10 disabled:opacity-40"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The beaches your team surveys. These fill the beach picker in Morning Survey and Nest
          Entry, and a beach's code prefixes every nest recorded there.
        </p>
      </header>

      {error && <ErrorMessage className="mb-4">{error}</ErrorMessage>}
      {notice && <SuccessMessage className="mb-4">{notice}</SuccessMessage>}

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Button onClick={() => { setError(null); setDraft({ ...emptyDraft }); }} icon={<Plus className="size-4" />}>
          Add a beach
        </Button>
        {retiredCount > 0 && (
          <button
            onClick={() => setShowRetired((v) => !v)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-4"
          >
            {showRetired ? 'Hide' : 'Show'} {retiredCount} retired
          </button>
        )}
      </div>

      {draft && (
        <div className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">
              {draft.id ? `Edit ${draft.name || 'beach'}` : 'New beach'}
            </h3>
            <button onClick={() => setDraft(null)} aria-label="Cancel" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="beach-name">Name</Label>
              <Input id="beach-name" value={draft.name} placeholder="Skala North"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="beach-code">Code</Label>
              <Input id="beach-code" value={draft.code} placeholder="SKN" maxLength={8}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
              <HelperText>
                Up to 8 letters or digits. Nests here will be numbered {(draft.code || 'SKN')}-1, {(draft.code || 'SKN')}-2 …
              </HelperText>
            </div>
            <div>
              <Label htmlFor="beach-area">Survey area</Label>
              <Input id="beach-area" value={draft.survey_area} placeholder="Skala" list="known-areas"
                onChange={(e) => setDraft({ ...draft, survey_area: e.target.value })} />
              <datalist id="known-areas">
                {groupings.survey_areas.map((a) => <option key={a} value={a} />)}
              </datalist>
              <HelperText>Beaches walked as one round. Morning Survey groups by this.</HelperText>
            </div>
            <div>
              <Label htmlFor="beach-station">Station</Label>
              <Input id="beach-station" value={draft.station} placeholder="East" list="known-stations"
                onChange={(e) => setDraft({ ...draft, station: e.target.value })} />
              <datalist id="known-stations">
                {groupings.stations.map((st) => <option key={st} value={st} />)}
              </datalist>
              <HelperText>The team base this beach is worked from.</HelperText>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={save} disabled={!draft.name || !draft.code || !draft.station || !draft.survey_area}>
              {draft.id ? 'Save changes' : 'Add beach'}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading beaches…</p>
      ) : visible.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <AlertCircle className="size-6 mx-auto mb-3 text-slate-400" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">No beaches yet</p>
          <p className="text-xs text-slate-500">
            Add your first beach to start recording surveys and nests.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {byArea.map(([area, list]) => (
            <section key={area}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                {area} — {list.length} {list.length === 1 ? 'beach' : 'beaches'}
              </h3>
              <ul className="space-y-2">
                {list.map((b) => {
                  const retired = b.is_active === false;
                  return (
                    <li key={b.id}
                        className={`p-3 rounded-xl border flex items-center gap-3 flex-wrap ${
                          retired
                            ? 'border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30 opacity-70'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                        }`}>
                      <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-black tabular-nums">
                        {b.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {b.name}
                          {retired && <span className="ml-2 text-[10px] font-black uppercase text-slate-400">Retired</span>}
                        </p>
                        <p className="text-xs text-slate-500">{b.station}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setError(null); setDraft({ id: b.id, name: b.name, code: b.code, station: b.station, survey_area: b.survey_area }); }}
                          className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10"
                          title="Edit" aria-label={`Edit ${b.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => setRetired(b, !retired)}
                          disabled={busyId === b.id}
                          className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-500/10 disabled:opacity-40"
                          title={retired ? 'Put back in use' : 'Retire this beach'}
                          aria-label={retired ? `Put ${b.name} back in use` : `Retire ${b.name}`}
                        >
                          {retired ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-slate-500 leading-relaxed">
        Beaches are retired rather than deleted. Nests, surveys and emergences refer to their
        beach by name, so removing one would orphan the fieldwork recorded there. A retired
        beach disappears from the pickers and its records stay readable.
      </p>
    </div>
  );
};

export default SiteManagement;
