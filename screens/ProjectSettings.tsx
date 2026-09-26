import React, { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal, Plus, Trash2, RefreshCw } from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { User, ReviewRules, RecordReview, ListSettings, AlertSettings } from '../types';
import { Button, Input, Label, ErrorMessage, SuccessMessage, HelperText } from '../components/UIComponents';

/**
 * What a Project Coordinator decides for their own site: when the nesting
 * seasons run and whose records a Field Leader has to confirm. Both used to be
 * constants in the code, which meant a developer for every season.
 */

interface ProjectSettingsProps {
  user: User;
  theme?: 'light' | 'dark';
  /** Lets App re-read the settings other screens hold (seasons, badge counts). */
  onSettingsChanged?: () => void;
}

interface SeasonDraft {
  /** Kept from the server so renaming a season does not orphan it as current. */
  id?: string;
  name: string;
  start: string;
  end: string;
}

const RECORD_TYPES: { type: RecordReview['record_type']; label: string }[] = [
  { type: 'nest', label: 'Nests' },
  { type: 'emergence', label: 'Emergences' },
  { type: 'nest_event', label: 'Inventories and nest events' },
  { type: 'turtle', label: 'Taggings' },
  { type: 'morning_survey', label: 'Morning surveys' },
];

const ROLES = ['Field Volunteer', 'Field Assistant', 'Field Leader', 'Project Coordinator'];

/** A list row, remembering whether it is already saved: saved options can be retired but not removed. */
type SpeciesRow = ListSettings['species'][number] & { saved: boolean };
type HealthRow = ListSettings['health_conditions'][number] & { saved: boolean };

const rowKey = (s: SeasonDraft, i: number) => s.id ?? `new-${i}`;

const ProjectSettings: React.FC<ProjectSettingsProps> = ({ user, onSettingsChanged }) => {
  const canManage = user.role.includes('Coordinator');

  const [isLoading, setIsLoading] = useState(true);
  const [seasons, setSeasons] = useState<SeasonDraft[]>([]);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [rules, setRules] = useState<ReviewRules | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveDays, setAutoApproveDays] = useState('7');
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [species, setSpecies] = useState<SpeciesRow[]>([]);
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [listsError, setListsError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertSettings | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'seasons' | 'rules' | 'lists' | 'alerts' | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const settings = await DatabaseConnection.getSettings();
    setSeasons(settings.seasons.seasons.map((s) => ({ ...s })));
    setCurrentKey(settings.seasons.current);
    setRules(settings.review_rules);
    setAutoApprove(settings.review_rules.auto_approve_days !== null);
    if (settings.review_rules.auto_approve_days !== null) {
      setAutoApproveDays(String(settings.review_rules.auto_approve_days));
    }
    setSpecies(settings.lists.species.map((o) => ({ ...o, saved: true })));
    setHealth(settings.lists.health_conditions.map((o) => ({ ...o, saved: true })));
    setAlerts(settings.alerts);
    setIsLoading(false);
  }, []);

  useEffect(() => { if (canManage) load(); }, [canManage, load]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const updateSeason = (index: number, changes: Partial<SeasonDraft>) =>
    setSeasons((prev) => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));

  const saveSeasons = async () => {
    setSeasonError(null);
    setSaving('seasons');
    try {
      const saved = await DatabaseConnection.saveSeasons({
        seasons: seasons.map((s) => ({ id: s.id ?? s.name.trim(), name: s.name, start: s.start, end: s.end })),
        current: currentKey === null
          ? null
          : (() => {
              const cur = seasons.find((s, i) => rowKey(s, i) === currentKey);
              return cur ? (cur.id ?? cur.name.trim()) : null;
            })(),
      });
      setSeasons(saved.seasons.map((s) => ({ ...s })));
      setCurrentKey(saved.current);
      flash('Seasons saved.');
      onSettingsChanged?.();
    } catch (err: any) {
      setSeasonError(err?.message || 'Could not save the seasons.');
    } finally {
      setSaving(null);
    }
  };

  const toggleRole = (type: RecordReview['record_type'], role: string) => {
    if (!rules) return;
    const has = rules.record_types[type].includes(role);
    setRules({
      ...rules,
      record_types: {
        ...rules.record_types,
        [type]: has ? rules.record_types[type].filter((r) => r !== role) : [...rules.record_types[type], role],
      },
    });
  };

  const saveRules = async () => {
    if (!rules) return;
    setRulesError(null);
    setSaving('rules');
    try {
      const days = autoApprove ? Number(autoApproveDays) : null;
      const saved = await DatabaseConnection.saveReviewRules({ ...rules, auto_approve_days: days });
      setRules(saved);
      flash('Review rules saved. They apply to records saved from now on.');
      onSettingsChanged?.();
    } catch (err: any) {
      setRulesError(err?.message || 'Could not save the review rules.');
    } finally {
      setSaving(null);
    }
  };

  const saveLists = async () => {
    setListsError(null);
    setSaving('lists');
    try {
      const strip = <T extends { saved: boolean }>({ saved, ...rest }: T) => rest;
      const saved = await DatabaseConnection.saveLists({
        species: species.map(strip) as ListSettings['species'],
        health_conditions: health.map(strip) as ListSettings['health_conditions'],
      });
      setSpecies(saved.species.map((o) => ({ ...o, saved: true })));
      setHealth(saved.health_conditions.map((o) => ({ ...o, saved: true })));
      flash('Lists saved. Records that already use a retired option keep it.');
      onSettingsChanged?.();
    } catch (err: any) {
      setListsError(err?.message || 'Could not save the lists.');
    } finally {
      setSaving(null);
    }
  };

  const saveAlerts = async () => {
    if (!alerts) return;
    setAlertsError(null);
    setSaving('alerts');
    try {
      setAlerts(await DatabaseConnection.saveAlertSettings(alerts));
      flash('Notification settings saved.');
      onSettingsChanged?.();
    } catch (err: any) {
      setAlertsError(err?.message || 'Could not save the notification settings.');
    } finally {
      setSaving(null);
    }
  };

  if (!canManage) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <p className="text-sm text-slate-500">Only a project coordinator can change the project settings.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <SlidersHorizontal className="size-6 text-primary shrink-0" />
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
          When your nesting seasons run, whose records a Field Leader confirms, the options in
          tagging dropdowns, and what raises an alert. Beaches are managed on their own page.
        </p>
      </header>

      {notice && <SuccessMessage className="mb-4">{notice}</SuccessMessage>}

      {/* Seasons ------------------------------------------------------- */}
      <section aria-labelledby="seasons-heading" className="mb-8 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 id="seasons-heading" className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white mb-1">
          Nesting seasons
        </h2>
        <HelperText className="mb-4">
          The season report and dashboard count nests by these dates. A record dated outside every
          season is still saved, with a warning to check the date. A season can run across New
          Year. With none set, each calendar year is a season.
        </HelperText>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            {seasons.length === 0 && (
              <p className="text-sm text-slate-500 mb-3">No seasons set. Add one to start using date ranges.</p>
            )}
            <ul className="space-y-3">
              {seasons.map((s, i) => (
                <li key={rowKey(s, i)} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_9rem_auto_auto] gap-3 items-end">
                  <div>
                    <Label htmlFor={`season-name-${i}`}>Name</Label>
                    <Input id={`season-name-${i}`} value={s.name} placeholder="2026"
                      onChange={(e) => updateSeason(i, { name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor={`season-start-${i}`}>Starts</Label>
                    <Input id={`season-start-${i}`} type="date" value={s.start}
                      onChange={(e) => updateSeason(i, { start: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor={`season-end-${i}`}>Ends</Label>
                    <Input id={`season-end-${i}`} type="date" value={s.end}
                      onChange={(e) => updateSeason(i, { end: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 pb-3">
                    <input
                      type="radio"
                      name="current-season"
                      checked={currentKey === rowKey(s, i)}
                      onChange={() => setCurrentKey(rowKey(s, i))}
                    />
                    Current
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSeasons((prev) => prev.filter((_, idx) => idx !== i));
                      if (currentKey === rowKey(s, i)) setCurrentKey(null);
                    }}
                    aria-label={`Remove season ${s.name || i + 1}`}
                    className="p-2 mb-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            {seasonError && <ErrorMessage className="mt-3">{seasonError}</ErrorMessage>}
            <div className="flex items-center gap-3 mt-4">
              <Button variant="outline" icon={<Plus className="size-4" />}
                onClick={() => setSeasons((prev) => [...prev, { name: '', start: '', end: '' }])}>
                Add a season
              </Button>
              <Button onClick={saveSeasons} disabled={saving !== null}>
                {saving === 'seasons' ? 'Saving…' : 'Save seasons'}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Review rules -------------------------------------------------- */}
      <section aria-labelledby="rules-heading" className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 id="rules-heading" className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white mb-1">
          Review rules
        </h2>
        <HelperText className="mb-4">
          Tick the roles whose records a Field Leader must confirm. A record is always saved
          straight away; this only decides whether it also waits in the review queue. Changes
          apply to records saved from now on - what is already queued stays queued.
        </HelperText>

        {isLoading || !rules ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Record</th>
                    {ROLES.map((role) => (
                      <th key={role} className="py-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                        {role.replace('Project ', '').replace('Field ', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECORD_TYPES.map(({ type, label }) => (
                    <tr key={type} className="border-t border-slate-200 dark:border-slate-800">
                      <th scope="row" className="py-2.5 pr-4 text-left font-bold text-slate-800 dark:text-slate-200">{label}</th>
                      {ROLES.map((role) => (
                        <td key={role} className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${role} ${label}`}
                            checked={rules.record_types[type].includes(role)}
                            onChange={() => toggleRole(type, role)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
                Approve automatically after
              </label>
              <div className="w-20">
                <Input aria-label="Days before automatic approval" type="number" min={1} max={90}
                  value={autoApproveDays} disabled={!autoApprove}
                  onChange={(e) => setAutoApproveDays(e.target.value)} />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300">days without review</span>
            </div>
            <HelperText className="mt-2">
              Keeps the queue from backing up. Automatic approvals are marked as such - they are
              never shown as a person's decision.
            </HelperText>

            {rulesError && <ErrorMessage className="mt-3">{rulesError}</ErrorMessage>}
            <div className="mt-4">
              <Button onClick={saveRules} disabled={saving !== null}>
                {saving === 'rules' ? 'Saving…' : 'Save review rules'}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Lists --------------------------------------------------------- */}
      <section aria-labelledby="lists-heading" className="mt-8 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 id="lists-heading" className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white mb-1">
          Dropdown lists
        </h2>
        <HelperText className="mb-4">
          The options offered when tagging a turtle. An option can be taken out of use but never
          deleted, so records that already hold it still read correctly. Nest status and event
          types are fixed - the app's counts depend on them.
        </HelperText>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Species</h3>
            <ul className="space-y-2 mb-3">
              {species.map((o, i) => (
                <li key={`sp-${i}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-center">
                  <Input aria-label="Scientific name" value={o.value} placeholder="Scientific name" disabled={o.saved}
                    onChange={(e) => setSpecies((prev) => prev.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))} />
                  <Input aria-label="Display name" value={o.label} placeholder="Loggerhead (Caretta caretta)"
                    onChange={(e) => setSpecies((prev) => prev.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))} />
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={o.active}
                      onChange={() => setSpecies((prev) => prev.map((r, idx) => (idx === i ? { ...r, active: !r.active } : r)))} />
                    In use
                  </label>
                  {o.saved ? <span className="w-8" /> : (
                    <button type="button" aria-label={`Remove ${o.value || 'new species'}`}
                      onClick={() => setSpecies((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="size-4" /></button>
                  )}
                </li>
              ))}
            </ul>
            <Button variant="outline" icon={<Plus className="size-4" />}
              onClick={() => setSpecies((prev) => [...prev, { value: '', label: '', active: true, saved: false }])}>
              Add a species
            </Button>

            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-6 mb-2">Health conditions</h3>
            <ul className="space-y-2 mb-3">
              {health.map((o, i) => (
                <li key={`hc-${i}`} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                  <Input aria-label="Condition" value={o.value} placeholder="Condition" disabled={o.saved}
                    onChange={(e) => setHealth((prev) => prev.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))} />
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={o.concerning}
                      onChange={() => setHealth((prev) => prev.map((r, idx) => (idx === i ? { ...r, concerning: !r.concerning } : r)))} />
                    Counts as a concern
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={o.active}
                      onChange={() => setHealth((prev) => prev.map((r, idx) => (idx === i ? { ...r, active: !r.active } : r)))} />
                    In use
                  </label>
                  {o.saved ? <span className="w-8" /> : (
                    <button type="button" aria-label={`Remove ${o.value || 'new condition'}`}
                      onClick={() => setHealth((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="size-4" /></button>
                  )}
                </li>
              ))}
            </ul>
            <Button variant="outline" icon={<Plus className="size-4" />}
              onClick={() => setHealth((prev) => [...prev, { value: '', concerning: false, active: true, saved: false }])}>
              Add a condition
            </Button>
            <HelperText className="mt-2">Conditions that count as a concern make up the dashboard's Injured figure.</HelperText>

            {listsError && <ErrorMessage className="mt-3">{listsError}</ErrorMessage>}
            <div className="mt-4">
              <Button onClick={saveLists} disabled={saving !== null}>
                {saving === 'lists' ? 'Saving…' : 'Save lists'}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Notifications -------------------------------------------------- */}
      <section aria-labelledby="alerts-heading" className="mt-8 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 id="alerts-heading" className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white mb-1">
          Notifications
        </h2>
        <HelperText className="mb-4">
          Alerts appear under the bell at the top of every screen. Nothing is emailed.
        </HelperText>

        {isLoading || !alerts ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <input type="checkbox" checked={alerts.reviewer_pending.enabled}
                    onChange={(e) => setAlerts({ ...alerts, reviewer_pending: { ...alerts.reviewer_pending, enabled: e.target.checked } })} />
                  Tell Field Leaders and Coordinators what is waiting for review
                </label>
                <div className="flex items-center gap-2 mt-2 ml-6 text-sm text-slate-600 dark:text-slate-300 flex-wrap">
                  <span>Only once it has waited</span>
                  <div className="w-20">
                    <Input aria-label="Hours a record waits before it becomes an alert" type="number" min={0} max={720}
                      value={alerts.reviewer_pending.after_hours} disabled={!alerts.reviewer_pending.enabled}
                      onChange={(e) => setAlerts({ ...alerts, reviewer_pending: { ...alerts.reviewer_pending, after_hours: Number(e.target.value) } })} />
                  </div>
                  <span>hours (0 = straight away)</span>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                <input type="checkbox" checked={alerts.submitter_feedback.enabled}
                  onChange={(e) => setAlerts({ ...alerts, submitter_feedback: { enabled: e.target.checked } })} />
                Tell whoever recorded something when it is approved or sent back for correction
              </label>
            </div>
            <HelperText className="mt-3">
              A record's alert is cleared by acknowledging it, and that clears it for everyone.
              A pending review clears when someone decides it.
            </HelperText>
            {alertsError && <ErrorMessage className="mt-3">{alertsError}</ErrorMessage>}
            <div className="mt-4">
              <Button onClick={saveAlerts} disabled={saving !== null}>
                {saving === 'alerts' ? 'Saving…' : 'Save notification settings'}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default ProjectSettings;
