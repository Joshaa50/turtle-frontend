import React, { useCallback, useEffect, useState } from 'react';
import {
  SlidersHorizontal, Plus, Trash2, RefreshCw, MapPinned, Clock, CalendarRange,
  ClipboardCheck, ListChecks, Bell, ShieldCheck, FormInput,
} from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { User, ReviewRules, RecordReview, ListSettings, AlertSettings, FieldRequirements, RetentionSettings } from '../types';
import { Button, Input, Label, ErrorMessage, SuccessMessage, HelperText, Select } from '../components/UIComponents';
import { FIELD_SCHEMA, type FormKey } from '../lib/fieldRequirements';
import type { ShiftData } from '../services/Database';
import SiteManagement from './SiteManagement';
import { surveyAreaTaskLabel } from '../lib/surveyAreas';

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
  /** Lets App refresh the beach list the rest of the app is holding, for the Beaches tab. */
  onBeachesChanged?: () => void;
}

type TabKey = 'beaches' | 'shifts' | 'seasons' | 'rules' | 'lists' | 'alerts' | 'retention' | 'fields';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  /** Whether the signed-in user is allowed to see this tab at all. */
  visible: boolean;
}

interface SeasonDraft {
  /** Kept from the server so renaming a season does not orphan it as current. */
  id?: string;
  name: string;
  start: string;
  end: string;
}

const RECORD_TYPES: { type: RecordReview['record_type']; label: string }[] = [
  { type: 'nest', label: 'Nests recorded on their own' },
  { type: 'emergence', label: 'Emergences recorded on their own' },
  { type: 'nest_event', label: 'Inventories and nest events' },
  { type: 'turtle', label: 'Taggings' },
  { type: 'morning_survey', label: 'Morning surveys' },
];

const ROLES = ['Field Volunteer', 'Field Assistant', 'Field Leader', 'Project Coordinator'];

const SHIFT_TYPES = ['Morning', 'Afternoon', 'Night', 'All Day'] as const;

const FORM_LABELS: { form: FormKey; label: string }[] = [
  { form: 'nest', label: 'Nest entry' },
  { form: 'emergence', label: 'Emergence' },
  { form: 'nest_event', label: 'Inventory / nest event' },
  { form: 'turtle', label: 'Tagging' },
  { form: 'morning_survey', label: 'Morning survey' },
];

/** A list row, remembering whether it is already saved: saved options can be retired but not removed. */
type SpeciesRow = ListSettings['species'][number] & { saved: boolean };
type HealthRow = ListSettings['health_conditions'][number] & { saved: boolean };

const rowKey = (s: SeasonDraft, i: number) => s.id ?? `new-${i}`;

interface ShiftDraft {
  /** Kept from the server so a rename does not orphan an in-flight edit. */
  shift_id?: number;
  shift_name: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  saved: boolean;
}

const toDraft = (s: ShiftData): ShiftDraft => ({
  shift_id: s.shift_id,
  shift_name: s.shift_name,
  shift_type: s.shift_type,
  start_time: (s.start_time || '').slice(0, 5),
  end_time: (s.end_time || '').slice(0, 5),
  is_active: s.is_active !== false,
  saved: true,
});

const ProjectSettings: React.FC<ProjectSettingsProps> = ({ user, onSettingsChanged, onBeachesChanged }) => {
  const canManage = user.role.includes('Coordinator');
  // Shift types are also a Field Leader's to run, same as the timetable itself.
  const canManageShifts = canManage || user.role === 'Field Leader';

  const allTabs: TabDef[] = [
    { key: 'beaches', label: 'Beaches', icon: <MapPinned className="size-4" />, visible: canManage },
    { key: 'shifts', label: 'Shift types', icon: <Clock className="size-4" />, visible: canManageShifts },
    { key: 'seasons', label: 'Nesting seasons', icon: <CalendarRange className="size-4" />, visible: canManage },
    { key: 'rules', label: 'Review rules', icon: <ClipboardCheck className="size-4" />, visible: canManage },
    { key: 'lists', label: 'Dropdown lists', icon: <ListChecks className="size-4" />, visible: canManage },
    { key: 'alerts', label: 'Notifications', icon: <Bell className="size-4" />, visible: canManage },
    { key: 'retention', label: 'Data retention', icon: <ShieldCheck className="size-4" />, visible: canManage },
    { key: 'fields', label: 'Form fields', icon: <FormInput className="size-4" />, visible: canManage },
  ];
  const tabs = allTabs.filter((t) => t.visible);

  const [activeTab, setActiveTab] = useState<TabKey>(tabs[0]?.key ?? 'shifts');
  // Once permissions resolve, make sure whatever is selected is actually a
  // visible tab (a Field Leader only ever has "shifts" to land on).
  useEffect(() => {
    if (!tabs.some((t) => t.key === activeTab) && tabs.length > 0) setActiveTab(tabs[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, canManageShifts]);

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
  const [fields, setFields] = useState<FieldRequirements | null>(null);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<ShiftDraft[]>([]);
  // Only to notice when a shift's configured name and its displayed name
  // (see surveyAreaTaskLabel) diverge, so that can be called out below -
  // this screen doesn't otherwise need beach data.
  const [shiftBeaches, setShiftBeaches] = useState<{ name: string; survey_area: string }[]>([]);
  const [showRetiredShifts, setShowRetiredShifts] = useState(false);
  const [shiftsError, setShiftsError] = useState<string | null>(null);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [busyShiftId, setBusyShiftId] = useState<number | 'new' | null>(null);
  const [retention, setRetention] = useState<RetentionSettings | null>(null);
  const [retentionDaysInput, setRetentionDaysInput] = useState('365');
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'seasons' | 'rules' | 'lists' | 'alerts' | 'fields' | 'retention' | null>(null);

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
    setFields(settings.field_requirements);
    setRetention(settings.retention);
    setRetentionDaysInput(String(settings.retention.inactive_days));
    setIsLoading(false);
  }, []);

  const loadShifts = useCallback(async () => {
    setIsLoadingShifts(true);
    const [list, beachList] = await Promise.all([
      DatabaseConnection.getShifts(),
      DatabaseConnection.getBeaches().catch(() => []),
    ]);
    setShifts((list as ShiftData[]).map(toDraft));
    setShiftBeaches(beachList);
    setIsLoadingShifts(false);
  }, []);

  useEffect(() => { if (canManage) load(); }, [canManage, load]);
  useEffect(() => { if (canManageShifts) loadShifts(); }, [canManageShifts, loadShifts]);

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

  const saveRetention = async () => {
    if (!retention) return;
    setRetentionError(null);
    const days = Number(retentionDaysInput);
    if (!Number.isInteger(days) || days < 30 || days > 3650) {
      setRetentionError('Enter a whole number of days from 30 to 3650 (about ten years).');
      return;
    }
    setSaving('retention');
    try {
      const saved = await DatabaseConnection.saveRetentionSettings({ ...retention, inactive_days: days });
      setRetention(saved);
      setRetentionDaysInput(String(saved.inactive_days));
      flash('Data retention settings saved.');
      onSettingsChanged?.();
    } catch (err: any) {
      setRetentionError(err?.message || 'Could not save the retention settings.');
    } finally {
      setSaving(null);
    }
  };

  const setFieldLevel = (form: FormKey, key: string, level: 'required' | 'recommended') => {
    if (!fields) return;
    setFields({ ...fields, [form]: { ...fields[form], [key]: level } });
  };

  const saveFields = async () => {
    if (!fields) return;
    setFieldsError(null);
    setSaving('fields');
    try {
      setFields(await DatabaseConnection.saveFieldRequirements(fields));
      flash('Form field requirements saved.');
      onSettingsChanged?.();
    } catch (err: any) {
      setFieldsError(err?.message || 'Could not save the form field requirements.');
    } finally {
      setSaving(null);
    }
  };

  const updateShiftDraft = (index: number, changes: Partial<ShiftDraft>) =>
    setShifts((prev) => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));

  const addShiftDraft = () =>
    setShifts((prev) => [...prev, { shift_name: '', shift_type: SHIFT_TYPES[0], start_time: '', end_time: '', is_active: true, saved: false }]);

  const saveShift = async (index: number) => {
    const draft = shifts[index];
    setShiftsError(null);
    setBusyShiftId(draft.shift_id ?? 'new');
    try {
      const payload = {
        shift_name: draft.shift_name,
        shift_type: draft.shift_type,
        start_time: draft.start_time || null,
        end_time: draft.end_time || null,
      };
      const saved = draft.shift_id
        ? await DatabaseConnection.updateShift(draft.shift_id, payload)
        : await DatabaseConnection.createShift(payload);
      setShifts((prev) => prev.map((s, i) => (i === index ? toDraft(saved) : s)));
      flash(draft.shift_id ? 'Shift updated.' : 'Shift added. It is now available on the timetable.');
      onSettingsChanged?.();
    } catch (err: any) {
      setShiftsError(err?.message || 'Could not save that shift.');
    } finally {
      setBusyShiftId(null);
    }
  };

  const setShiftRetired = async (index: number, retired: boolean) => {
    const draft = shifts[index];
    if (!draft.shift_id) return;
    setShiftsError(null);
    setBusyShiftId(draft.shift_id);
    try {
      const saved = await DatabaseConnection.updateShift(draft.shift_id, { is_active: !retired });
      setShifts((prev) => prev.map((s, i) => (i === index ? toDraft(saved) : s)));
      flash(retired ? `${draft.shift_name} retired. Past assignments are unchanged.` : `${draft.shift_name} is back in use.`);
      onSettingsChanged?.();
    } catch (err: any) {
      setShiftsError(err?.message || 'Could not update that shift.');
    } finally {
      setBusyShiftId(null);
    }
  };

  const visibleShifts = shifts
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => showRetiredShifts || s.is_active || !s.saved);
  const retiredShiftCount = shifts.filter((s) => s.saved && !s.is_active).length;

  if (!canManage && !canManageShifts) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <p className="text-sm text-slate-500">Only a project coordinator or Field Leader can change the project settings.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <SlidersHorizontal className="size-6 text-primary shrink-0" />
          <button
            onClick={() => { if (canManage) load(); if (canManageShifts) loadShifts(); }}
            disabled={isLoading || isLoadingShifts}
            className="ml-auto p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/10 disabled:opacity-40"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${isLoading || isLoadingShifts ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {canManage
            ? 'The beaches your team surveys, when your nesting seasons run, whose records a Field Leader confirms, the options in tagging dropdowns, what raises an alert, and the shift types on the timetable.'
            : 'The shift types available on the timetable. The rest of Project Settings is a coordinator\'s.'}
        </p>
      </header>

      {/* Tab picker: a dropdown on narrow screens, pill buttons once there's room. */}
      {/* A Field Leader only ever has one tab (Shift types) - nothing to pick between. */}
      {tabs.length > 1 && (
      <div className="mb-6">
        <div className="sm:hidden">
          <Select
            aria-label="Settings section"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as TabKey)}
          >
            {tabs.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
        </div>
        <div className="hidden sm:flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              aria-current={activeTab === t.key}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors border ${
                activeTab === t.key
                  ? 'bg-primary text-white border-primary'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-500/10'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {notice && <SuccessMessage className="mb-4">{notice}</SuccessMessage>}

      {/* Beaches ----------------------------------------------------------- */}
      {canManage && activeTab === 'beaches' && (
        <SiteManagement user={user} onBeachesChanged={onBeachesChanged} embedded />
      )}

      {/* Shift types ----------------------------------------------------- */}
      {canManageShifts && activeTab === 'shifts' && (
        <section aria-labelledby="shifts-heading" className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h2 id="shifts-heading" className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white mb-1">
            Shift types
          </h2>
          <HelperText className="mb-4">
            The tasks offered when building the timetable - a beach survey, sand sifting, a night
            patrol. A type can be retired but not deleted, so past weeks still read correctly. Leave
            the end time blank for an open-ended shift, like a morning survey.
          </HelperText>

          {isLoadingShifts ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <ul className="space-y-3">
                {visibleShifts.map(({ s, index }) => (
                  <li key={s.shift_id ?? `new-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_7.5rem_7.5rem_auto] gap-3 items-end">
                    <div>
                      <Label htmlFor={`shift-name-${index}`}>Name</Label>
                      <Input id={`shift-name-${index}`} value={s.shift_name} placeholder="Night Patrol"
                        onChange={(e) => updateShiftDraft(index, { shift_name: e.target.value })} />
                      {(() => {
                        const displayed = surveyAreaTaskLabel(s.shift_name, shiftBeaches);
                        // surveyAreaTaskLabel also normalises "Clean up" ->
                        // "Clean Up" capitalisation, which isn't the beach ->
                        // survey-area rename this note is about - comparing
                        // case-insensitively leaves only a real rename.
                        return displayed.toLowerCase() !== s.shift_name.toLowerCase() ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Shown elsewhere as "{displayed}" — the Time Table and Morning Survey name a beach survey after its survey area.
                          </p>
                        ) : null;
                      })()}
                    </div>
                    <div>
                      <Label htmlFor={`shift-type-${index}`}>Type</Label>
                      <select
                        id={`shift-type-${index}`}
                        value={s.shift_type}
                        onChange={(e) => updateShiftDraft(index, { shift_type: e.target.value })}
                        className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        {SHIFT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor={`shift-start-${index}`}>Starts</Label>
                      <Input id={`shift-start-${index}`} type="time" value={s.start_time}
                        onChange={(e) => updateShiftDraft(index, { start_time: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor={`shift-end-${index}`}>Ends</Label>
                      <Input id={`shift-end-${index}`} type="time" value={s.end_time}
                        onChange={(e) => updateShiftDraft(index, { end_time: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2 pb-0.5">
                      <Button
                        onClick={() => saveShift(index)}
                        disabled={busyShiftId !== null || !s.shift_name.trim()}
                        size="sm"
                      >
                        {busyShiftId === (s.shift_id ?? 'new') ? 'Saving…' : s.saved ? 'Save' : 'Add'}
                      </Button>
                      {s.saved && (
                        <button
                          type="button"
                          onClick={() => setShiftRetired(index, s.is_active)}
                          disabled={busyShiftId !== null}
                          aria-label={s.is_active ? `Retire ${s.shift_name}` : `Restore ${s.shift_name}`}
                          className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-50"
                        >
                          {s.is_active ? <Trash2 className="size-4" /> : <Plus className="size-4" />}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {shiftsError && <ErrorMessage className="mt-3">{shiftsError}</ErrorMessage>}
              <div className="flex items-center gap-3 mt-4">
                <Button variant="outline" icon={<Plus className="size-4" />} onClick={addShiftDraft}>
                  Add a shift type
                </Button>
                {retiredShiftCount > 0 && (
                  <button
                    onClick={() => setShowRetiredShifts((v) => !v)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-4"
                  >
                    {showRetiredShifts ? 'Hide' : 'Show'} {retiredShiftCount} retired
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Seasons ------------------------------------------------------- */}
      {canManage && activeTab === 'seasons' && (
      <section aria-labelledby="seasons-heading" className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
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
      )}

      {/* Review rules -------------------------------------------------- */}
      {canManage && activeTab === 'rules' && (
      <section aria-labelledby="rules-heading" className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 id="rules-heading" className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white mb-1">
          Review rules
        </h2>
        <HelperText className="mb-4">
          Tick the roles whose records a Field Leader must confirm. A record is always saved
          straight away; this only decides whether it also waits in the review queue. A morning
          survey is reviewed as one form, with the nests and emergences recorded on it, so those
          follow the survey's rule. Changes apply to records saved from now on - what is already
          queued stays queued.
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
      )}

      {/* Lists --------------------------------------------------------- */}
      {canManage && activeTab === 'lists' && (
      <section aria-labelledby="lists-heading" className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
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
      )}

      {/* Notifications -------------------------------------------------- */}
      {canManage && activeTab === 'alerts' && (
      <section aria-labelledby="alerts-heading" className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
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
      )}

      {/* Data retention ---------------------------------------------------- */}
      {canManage && activeTab === 'retention' && (
      <section aria-labelledby="retention-heading" className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 id="retention-heading" className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white mb-1">
          Data retention
        </h2>
        <HelperText className="mb-4">
          Field records — nests, emergences, turtles, surveys — are kept forever; that is not
          configurable here, and is not what this affects. This only concerns dormant{' '}
          <em>accounts</em>: when someone has not signed in for the chosen number of days, their
          name, email and other identifying details are erased the same way a coordinator-run
          erasure works today — the observations they recorded stay, credited to "Removed"
          instead of their name. Off by default.
        </HelperText>

        {isLoading || !retention ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={retention.auto_erase_enabled}
                onChange={(e) => setRetention({ ...retention, auto_erase_enabled: e.target.checked })}
              />
              Automatically erase an account after
            </label>
            <div className="flex items-center gap-2 mt-2 ml-6 flex-wrap">
              <div className="w-24">
                <Input
                  aria-label="Days of inactivity before automatic erasure"
                  type="number"
                  min={30}
                  max={3650}
                  value={retentionDaysInput}
                  disabled={!retention.auto_erase_enabled}
                  onChange={(e) => setRetentionDaysInput(e.target.value)}
                />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300">days of no sign-in</span>
            </div>
            <HelperText className="mt-3">
              You will see a warning under the bell 14 days before anyone is actually erased, so
              there is a chance to notice "on a long break" before it becomes permanent. The
              account that is the only active coordinator is never erased this way, however
              long they have been away, and the demo accounts used to show the app are never
              swept.
            </HelperText>
            {retentionError && <ErrorMessage className="mt-3">{retentionError}</ErrorMessage>}
            <div className="mt-4">
              <Button onClick={saveRetention} disabled={saving !== null}>
                {saving === 'retention' ? 'Saving…' : 'Save retention settings'}
              </Button>
            </div>
          </>
        )}
      </section>
      )}

      {/* Form fields ----------------------------------------------------- */}
      {canManage && activeTab === 'fields' && (
      <section aria-labelledby="fields-heading" className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 id="fields-heading" className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white mb-1">
          Form fields
        </h2>
        <HelperText className="mb-4">
          Only fields your site can genuinely make optional are listed here - things like GPS,
          triangulation, tags and notes. A record's date, code and type stay required; the app
          depends on them. "Recommended" is shown on the form but never blocks a save.
        </HelperText>

        {isLoading || !fields ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="space-y-6">
              {FORM_LABELS.map(({ form, label }) => (
                <div key={form}>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</h3>
                  <ul className="space-y-1.5">
                    {Object.entries(FIELD_SCHEMA[form]).map(([key, def]) => (
                      <li key={key} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-700 dark:text-slate-200">{def.label}</span>
                        <div className="flex items-center gap-1 shrink-0" role="radiogroup" aria-label={def.label}>
                          {(['required', 'recommended'] as const).map((level) => (
                            <button
                              key={level}
                              type="button"
                              role="radio"
                              aria-checked={fields[form][key] === level}
                              onClick={() => setFieldLevel(form, key, level)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border transition-colors ${
                                fields[form][key] === level
                                  ? 'bg-primary text-white border-primary'
                                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-500/10'
                              }`}
                            >
                              {level === 'required' ? 'Required' : 'Recommended'}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <HelperText className="mt-4">
              Reburied measurements only apply once eggs were actually reburied - that part is not
              configurable. Changes apply to records saved from now on.
            </HelperText>
            {fieldsError && <ErrorMessage className="mt-3">{fieldsError}</ErrorMessage>}
            <div className="mt-4">
              <Button onClick={saveFields} disabled={saving !== null}>
                {saving === 'fields' ? 'Saving…' : 'Save form fields'}
              </Button>
            </div>
          </>
        )}
      </section>
      )}
    </div>
  );
};

export default ProjectSettings;
