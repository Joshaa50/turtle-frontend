/**
 * Coordinator-configurable field requirements, mirrored from the backend's
 * FORM_FIELD_SCHEMA in server.js. Keep the two in step: this only names the
 * fields the coordinator is allowed to loosen or tighten (GPS, measurements,
 * tags, notes...) - never the structural ones the app cannot run without
 * (nest_code, dates, event_type, beach), which stay hardcoded on both ends.
 *
 * The backend is the source of truth for what is actually enforced; this
 * copy exists so a screen can show the right asterisk and block a save
 * before spending a round trip on it. A screen that fails to load the
 * settings falls back to the same defaults the backend would use, so it is
 * never stricter or looser than the API by accident.
 */

export type FieldLevel = 'required' | 'recommended';

export type FormKey = 'nest' | 'emergence' | 'nest_event' | 'turtle' | 'morning_survey';

export interface FieldDef {
  keys: string[];
  label: string;
  default: FieldLevel;
  /** Only enforced when this returns true - e.g. reburied measurements only matter once eggs were reburied. */
  conditional?: (values: Record<string, any>) => boolean;
}

export type FormFieldSchema = Record<FormKey, Record<string, FieldDef>>;

export const FIELD_SCHEMA: FormFieldSchema = {
  nest: {
    gps: { keys: ['gps_lat', 'gps_long'], label: 'GPS', default: 'required' },
    distance_to_sea_s: { keys: ['distance_to_sea_s'], label: 'Distance to sea', default: 'required' },
    track_sketch: { keys: ['track_sketch'], label: 'Track sketch', default: 'recommended' },
    triangulation: {
      keys: ['tri_tl_desc', 'tri_tl_lat', 'tri_tl_long', 'tri_tl_distance', 'tri_tr_desc', 'tri_tr_lat', 'tri_tr_long', 'tri_tr_distance'],
      label: 'Triangulation', default: 'recommended',
    },
    notes: { keys: ['notes'], label: 'Notes', default: 'recommended' },
  },
  emergence: {
    gps: { keys: ['gps_lat', 'gps_long'], label: 'GPS', default: 'recommended' },
    distance_to_sea_s: { keys: ['distance_to_sea_s'], label: 'Distance to sea', default: 'recommended' },
    track_sketch: { keys: ['track_sketch'], label: 'Track sketch', default: 'recommended' },
  },
  nest_event: {
    reburied_measurements: {
      keys: ['reburied_depth_top_egg_h', 'reburied_depth_bottom_chamber_h', 'reburied_width_w', 'reburied_distance_to_sea_s', 'reburied_gps_lat', 'reburied_gps_long'],
      label: 'Reburied measurements', default: 'recommended',
      conditional: (v) => Number(v.eggs_reburied) > 0,
    },
    observer: { keys: ['observer'], label: 'Observer', default: 'recommended' },
    notes: { keys: ['notes'], label: 'Notes', default: 'recommended' },
  },
  turtle: {
    front_left_tag: { keys: ['front_left_tag', 'front_left_address'], label: 'Front-left tag', default: 'recommended' },
    front_right_tag: { keys: ['front_right_tag', 'front_right_address'], label: 'Front-right tag', default: 'recommended' },
    rear_left_tag: { keys: ['rear_left_tag', 'rear_left_address'], label: 'Rear-left tag', default: 'recommended' },
    rear_right_tag: { keys: ['rear_right_tag', 'rear_right_address'], label: 'Rear-right tag', default: 'recommended' },
    measurements: {
      keys: ['scl_max', 'scl_min', 'scw', 'ccl_max', 'ccl_min', 'ccw'],
      label: 'Measurements', default: 'required',
    },
    // QA-063: previously bundled into "measurements" above, all-or-nothing -
    // a turtle that bolted or had tail damage before every figure could be
    // taken couldn't be saved at all. Mirrors the backend's split in
    // FORM_FIELD_SCHEMA; keep the two in step.
    tail_measurements: {
      keys: ['tail_extension', 'vent_to_tail_tip', 'total_tail_length'],
      label: 'Tail measurements', default: 'recommended',
    },
  },
  morning_survey: {
    gps: { keys: ['tl_lat', 'tl_long', 'tr_lat', 'tr_long'], label: 'Corner GPS', default: 'recommended' },
    protected_nest_count: { keys: ['protected_nest_count'], label: 'Protected nest count', default: 'recommended' },
    notes: { keys: ['notes'], label: 'Notes', default: 'recommended' },
  },
};

export type FieldRequirements = { [F in FormKey]: Record<string, FieldLevel> };

export const defaultFieldRequirements = (): FieldRequirements => {
  const out = {} as FieldRequirements;
  for (const form of Object.keys(FIELD_SCHEMA) as FormKey[]) {
    out[form] = Object.fromEntries(Object.entries(FIELD_SCHEMA[form]).map(([key, def]) => [key, def.default]));
  }
  return out;
};

/** Whether a field should show its required marker and block an empty save. */
export const isRequired = (
  levels: FieldRequirements | undefined,
  form: FormKey,
  field: string,
  values: Record<string, any> = {}
): boolean => {
  const def = FIELD_SCHEMA[form][field];
  if (!def) return false;
  if (def.conditional && !def.conditional(values)) return false;
  return (levels?.[form]?.[field] ?? def.default) === 'required';
};

const isBlank = (v: unknown) => v === null || v === undefined || v === '';

/**
 * Every configured-required field in `form` that is blank in `values`, as
 * {field, label} pairs - for a save handler to block on and report, the same
 * way the backend would reject the request if it reached it.
 */
export const missingRequiredFields = (
  levels: FieldRequirements | undefined,
  form: FormKey,
  values: Record<string, any>
): { field: string; label: string }[] => {
  const out: { field: string; label: string }[] = [];
  for (const [field, def] of Object.entries(FIELD_SCHEMA[form])) {
    if (!isRequired(levels, form, field, values)) continue;
    if (def.keys.some((k) => isBlank(values[k]))) out.push({ field, label: def.label });
  }
  return out;
};
