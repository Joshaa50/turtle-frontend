import { formatDate, formatDateTime } from './utils';

/**
 * Turns the record behind a review into the form a Field Leader is confirming:
 * every field the volunteer filled in, grouped the way the entry screen groups
 * them. The server sends the whole row, so this is where it becomes readable.
 *
 * Anything the layouts below do not name still appears, under "Other details" -
 * a column added to a form later must show up for the reviewer rather than
 * quietly go unchecked.
 */

export interface FormRow {
  label: string;
  value: string;
}

export interface FormSection {
  title: string;
  rows: FormRow[];
}

/** One line of a layout: a single field, or several fields shown as one value. */
type Line =
  | string
  | { label: string; keys: string[]; sep?: string }
  | { label: string; stage: string };

interface Group {
  title: string;
  lines: Line[];
}

const TOKEN_WORDS: Record<string, string> = {
  gps: 'GPS', lat: 'latitude', long: 'longitude', tl: 'top-left', tr: 'top-right',
  num: 'number', img: 'photo', desc: 'description', scl: 'SCL', scw: 'SCW',
  ccl: 'CCL', ccw: 'CCW',
};

/** "distance_to_sea_s" -> "Distance to sea"; the trailing s/h/w are unit suffixes. */
export const humaniseKey = (key: string): string => {
  const tokens = key.replace(/^has_/, '').split('_').filter(Boolean);
  if (tokens.length > 1 && ['s', 'h', 'w'].includes(tokens[tokens.length - 1])) tokens.pop();
  const words = tokens.map((t) => TOKEN_WORDS[t] ?? t);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Bookkeeping columns a reviewer has no use for. */
const isHidden = (key: string) =>
  key === 'id' || key.endsWith('_id') || key === 'is_archived' || key === 'created_at' || key === 'updated_at';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const CLOCK = /^\d{2}:\d{2}:\d{2}$/;

const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

export const formatValue = (key: string, value: unknown): string => {
  if (typeof value === 'boolean') {
    return key.startsWith('has_') ? (value ? 'Attached' : 'None') : value ? 'Yes' : 'No';
  }
  if (typeof value === 'string') {
    if (ISO_DATETIME.test(value)) return formatDateTime(value);
    if (ISO_DATE.test(value)) return formatDate(value);
    if (CLOCK.test(value)) return value.slice(0, 5);
    if (key === 'event_type') return value.replace(/_/g, ' ').toLowerCase();
  }
  if (key === 'distance_to_sea_s' || key === 'original_distance_to_sea_s' || key === 'reburied_distance_to_sea_s') {
    return `${value} m`;
  }
  return String(value);
};

const STAGES: [string, string][] = [
  ['hatched', 'Hatched'],
  ['non_viable', 'Non-viable'],
  ['eye_spot', 'Eye spot'],
  ['early', 'Early'],
  ['middle', 'Middle'],
  ['late', 'Late'],
  ['piped_dead', 'Piped dead'],
];
const INFECTIONS: [string, string][] = [
  ['black_fungus', 'black fungus'],
  ['green_bacteria', 'green bacteria'],
  ['pink_bacteria', 'pink bacteria'],
];

const gps = (label: string, lat: string, long: string): Line => ({ label, keys: [lat, long], sep: ', ' });

const TAGS: Line[] = ['front_left', 'front_right', 'rear_left', 'rear_right'].map((pos) => ({
  label: `${humaniseKey(pos)} tag`,
  keys: [`${pos}_tag`, `${pos}_address`],
  sep: ' · ',
}));

const MEASUREMENTS: string[] = [
  'scl_max', 'scl_min', 'scw', 'ccl_max', 'ccl_min', 'ccw',
  'tail_extension', 'vent_to_tail_tip', 'total_tail_length',
];

const LAYOUTS: Record<string, Group[]> = {
  nest: [
    {
      title: 'Nest',
      lines: [
        'nest_code', 'date_found', 'beach', 'status', 'relocated',
        gps('GPS', 'gps_lat', 'gps_long'), 'distance_to_sea_s',
        'total_num_eggs', 'current_num_eggs',
        'depth_top_egg_h', 'depth_bottom_chamber_h', 'width_w',
      ],
    },
    {
      title: 'Triangulation',
      lines: [
        'tri_tl_desc', gps('Top-left GPS', 'tri_tl_lat', 'tri_tl_long'), 'tri_tl_distance',
        'tri_tr_desc', gps('Top-right GPS', 'tri_tr_lat', 'tri_tr_long'), 'tri_tr_distance',
        'has_triangulation_photos',
      ],
    },
    { title: 'Photos and notes', lines: ['photo_count', 'notes'] },
  ],
  emergence: [
    {
      title: 'Emergence',
      lines: [
        'emergence_type', 'event_date', 'beach', gps('GPS', 'gps_lat', 'gps_long'),
        'distance_to_sea_s', 'has_track_sketch', 'linked_nest_code',
      ],
    },
  ],
  nest_event: [
    { title: 'Event', lines: ['event_type', 'nest_code', 'observer', 'start_time', 'end_time'] },
    {
      title: 'Original nest measurements',
      lines: [
        'original_depth_top_egg_h', 'original_depth_bottom_chamber_h', 'original_width_w',
        'original_distance_to_sea_s', gps('GPS', 'original_gps_lat', 'original_gps_long'),
      ],
    },
    {
      title: 'Eggs and hatchlings',
      lines: [
        'total_eggs', 'helped_to_sea', 'eggs_reburied', 'tracks_to_sea', 'tracks_lost',
        'piped_alive_count', 'alive_within', 'dead_within', 'alive_above', 'dead_above',
      ],
    },
    {
      // One line per stage, its infection counts folded in, so the table reads
      // the way the inventory screen's does.
      title: 'Embryo stages and infection',
      lines: STAGES.map(([stage, label]) => ({ label, stage })),
    },
    {
      title: 'Reburied nest measurements',
      lines: [
        'reburied_depth_top_egg_h', 'reburied_depth_bottom_chamber_h', 'reburied_width_w',
        'reburied_distance_to_sea_s', gps('GPS', 'reburied_gps_lat', 'reburied_gps_long'),
      ],
    },
    { title: 'Notes', lines: ['notes'] },
  ],
  turtle: [
    { title: 'Animal', lines: ['name', 'species', 'sex', 'health_condition'] },
    { title: 'Tags', lines: TAGS },
    { title: 'Measurements', lines: MEASUREMENTS },
  ],
  morning_survey: [
    {
      title: 'Survey',
      lines: [
        'survey_date', 'beach', { label: 'Times', keys: ['start_time', 'end_time'], sep: ' – ' },
        gps('Top-left GPS', 'tl_lat', 'tl_long'), gps('Top-right GPS', 'tr_lat', 'tr_long'),
        'protected_nest_count', 'notes',
      ],
    },
  ],
};

/** Layout for one sighting recorded against a turtle. */
const SIGHTING: Group[] = [
  {
    title: 'Sighting',
    lines: [
      'event_date', 'event_type', 'location', 'observer', 'health_condition',
      'time_first_seen', 'time_start_egg_laying', 'time_covering', 'time_end_camouflage', 'time_reach_sea',
    ],
  },
  { title: 'Tags', lines: TAGS },
  { title: 'Measurements', lines: MEASUREMENTS },
  { title: 'Notes', lines: ['notes'] },
];

const stageLine = (d: Record<string, any>, stage: string, label: string): FormRow | null => {
  const total = d[`${stage}_count`];
  const infected = INFECTIONS
    .filter(([i]) => !isEmpty(d[`${stage}_${i}_count`]))
    .map(([i, name]) => `${name} ${d[`${stage}_${i}_count`]}`);
  if (isEmpty(total) && infected.length === 0) return null;
  return { label, value: `${isEmpty(total) ? '–' : total}${infected.length ? ` (${infected.join(', ')})` : ''}` };
};

/** Renders the layouts against one record; returns sections plus the keys it consumed. */
const renderGroups = (
  groups: Group[],
  d: Record<string, any>,
  consumed: Set<string>
): FormSection[] =>
  groups
    .map((group) => {
      const rows: FormRow[] = [];
      for (const line of group.lines) {
        if (typeof line === 'string') {
          consumed.add(line);
          if (!isEmpty(d[line])) rows.push({ label: humaniseKey(line), value: formatValue(line, d[line]) });
          continue;
        }
        // A stage line spans four columns (total plus three infections).
        if ('stage' in line) {
          consumed.add(`${line.stage}_count`);
          INFECTIONS.forEach(([i]) => consumed.add(`${line.stage}_${i}_count`));
          const row = stageLine(d, line.stage, line.label);
          if (row) rows.push(row);
          continue;
        }
        line.keys.forEach((k) => consumed.add(k));
        const parts = line.keys.filter((k) => !isEmpty(d[k])).map((k) => formatValue(k, d[k]));
        if (parts.length) rows.push({ label: line.label, value: parts.join(line.sep ?? ' ') });
      }
      return { title: group.title, rows };
    })
    .filter((s) => s.rows.length > 0);

/** Fields no layout named, so a column added later is still put in front of the reviewer. */
const leftovers = (d: Record<string, any>, consumed: Set<string>): FormSection | null => {
  const rows = Object.keys(d)
    .filter((k) => !consumed.has(k) && !isHidden(k) && !isEmpty(d[k]) && typeof d[k] !== 'object')
    .sort()
    .map((k) => ({ label: humaniseKey(k), value: formatValue(k, d[k]) }));
  return rows.length ? { title: 'Other details', rows } : null;
};

const dateLabel = (d: Record<string, any>, key: string) =>
  isEmpty(d[key]) ? '' : ` · ${formatValue(key, d[key])}`;

/**
 * Record types a submitter can correct and resend themselves, once rejected.
 * Left out on purpose:
 *  - "nest" - its update route replaces the triangulation photos wholesale,
 *    so a generic resubmit (which does not re-send photos) would delete them.
 *  - "morning_survey" - there is no update route for the survey itself; what
 *    is wrong is one of the nests/emergences recorded on it, which are their
 *    own record types with their own review.
 * Both still need a Field Leader or Coordinator to make the correction.
 */
export const RESUBMIT_EDITABLE_TYPES: ReadonlySet<string> = new Set(['emergence', 'turtle', 'nest_event']);

/**
 * Fields a layout shows but a correction form must not expose: computed
 * values that have no column to write (emergence_type, has_track_sketch,
 * linked_nest_code), and identity/classification fields where a typo would
 * misfile the record rather than just correct a measurement (event_type,
 * nest_code, and - for a turtle - name/species/sex/health_condition, which
 * are picked from a controlled list elsewhere, not free text).
 */
const NOT_RESUBMIT_EDITABLE: Record<string, Set<string>> = {
  emergence: new Set(['emergence_type', 'has_track_sketch', 'linked_nest_code']),
  turtle: new Set(['name', 'species', 'sex', 'health_condition']),
  nest_event: new Set(['event_type', 'nest_code']),
};

export interface EditableField {
  key: string;
  label: string;
}

/**
 * The same fields a reviewer sees for this record type, flattened to one
 * entry per underlying column - what a correction form edits is exactly what
 * confirmation shows, so nothing is fixable here that a reviewer couldn't see.
 * Stage/infection breakdowns are left as read-only context (the stage totals
 * are included); correcting those goes through a Field Leader instead.
 */
export const editableFieldsFor = (recordType: string): EditableField[] => {
  if (!RESUBMIT_EDITABLE_TYPES.has(recordType)) return [];
  const layout = LAYOUTS[recordType];
  if (!layout) return [];
  const excluded = NOT_RESUBMIT_EDITABLE[recordType];
  const fields: EditableField[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string) => {
    if (seen.has(key) || excluded?.has(key)) return;
    seen.add(key);
    fields.push({ key, label });
  };
  for (const group of layout) {
    for (const line of group.lines) {
      if (typeof line === 'string') {
        add(line, humaniseKey(line));
      } else if ('keys' in line) {
        line.keys.forEach((k) => add(k, humaniseKey(k)));
      } else {
        add(`${line.stage}_count`, `${line.label} count`);
      }
    }
  }
  return fields;
};

/** date/datetime/number/text - which kind of <input> a field's current value wants. */
export const inputKindFor = (value: unknown): 'date' | 'datetime' | 'number' | 'text' => {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    if (ISO_DATETIME.test(value)) return 'datetime';
    if (ISO_DATE.test(value)) return 'date';
  }
  return 'text';
};

/** The whole stored row, but with every field value turned into an edit-form string. */
export const toEditValues = (
  recordType: string,
  detail: Record<string, any>,
  fields: EditableField[]
): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const { key } of fields) {
    const v = detail[key];
    if (v === null || v === undefined) {
      values[key] = '';
    } else if (inputKindFor(v) === 'datetime') {
      values[key] = String(v).slice(0, 16); // yyyy-MM-ddTHH:mm, what a datetime-local input wants
    } else {
      values[key] = String(v);
    }
  }
  return values;
};

/**
 * Builds the body for the record's own update call: the stored row (so every
 * field the route needs is present) with the edited fields parsed back to
 * their real type and layered on top.
 */
export const buildResubmitPayload = (
  detail: Record<string, any>,
  fields: EditableField[],
  edits: Record<string, string>
): Record<string, any> => {
  const payload: Record<string, any> = { ...detail };
  for (const { key } of fields) {
    if (!(key in edits)) continue; // not offered for edit here - keep the stored value
    const raw = edits[key];
    const original = detail[key];
    if (raw === '') {
      payload[key] = null;
      continue;
    }
    const kind = inputKindFor(original);
    if (kind === 'number') {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        payload[key] = original;
      } else {
        // Several of these columns (distances, depths, counts) are stored as
        // whole numbers and the write fails outright on a decimal - a field
        // whose own stored value was already a whole number is one of them.
        payload[key] = Number.isInteger(original) ? Math.round(n) : n;
      }
    } else if (kind === 'datetime') {
      // Needs full seconds precision - a bare "HH:mm" is rejected by the API.
      payload[key] = raw.length === 16 ? `${raw}:00` : raw;
    } else {
      payload[key] = raw;
    }
  }
  return payload;
};

/**
 * The whole form behind a review, as titled sections. Empty when the record
 * could not be loaded, so the card can say so instead of showing a blank.
 */
export const buildFormSections = (
  recordType: string,
  detail: Record<string, any> | null | undefined
): FormSection[] => {
  if (!detail) return [];
  const layout = LAYOUTS[recordType];
  if (!layout) return [];

  const consumed = new Set<string>();
  const sections = renderGroups(layout, detail, consumed);

  if (recordType === 'turtle') {
    consumed.add('survey_events');
    const events: Record<string, any>[] = Array.isArray(detail.survey_events) ? detail.survey_events : [];
    events.forEach((ev, i) => {
      const evConsumed = new Set<string>();
      const parts = renderGroups(SIGHTING, ev, evConsumed);
      const extra = leftovers(ev, evConsumed);
      const rows = [...parts.flatMap((p) => p.rows), ...(extra ? extra.rows : [])];
      if (rows.length) sections.push({ title: `Sighting ${i + 1}${dateLabel(ev, 'event_date')}`, rows });
    });
  }

  if (recordType === 'morning_survey') {
    consumed.add('linked_nests');
    consumed.add('linked_emergences');
    const nests: Record<string, any>[] = Array.isArray(detail.linked_nests) ? detail.linked_nests : [];
    const emergences: Record<string, any>[] = Array.isArray(detail.linked_emergences) ? detail.linked_emergences : [];
    // The survey is one form: each nest and emergence recorded on it is shown
    // in full, as it would be on its own, so the leader confirms the lot at once.
    const childSection = (title: string, layout: Group[], child: Record<string, any>) => {
      const used = new Set<string>();
      const parts = renderGroups(layout, child, used);
      const extra = leftovers(child, used);
      const rows = [...parts.flatMap((p) => p.rows), ...(extra ? extra.rows : [])];
      return rows.length ? { title, rows } : null;
    };
    nests.forEach((n) => {
      const section = childSection(`Nest ${n.nest_code ?? ''}`.trim(), LAYOUTS.nest, n);
      if (section) sections.push(section);
    });
    emergences.forEach((e, i) => {
      const where = isEmpty(e.beach) ? '' : ` · ${e.beach}`;
      const section = childSection(`Emergence ${i + 1}${where}`, LAYOUTS.emergence, e);
      if (section) sections.push(section);
    });
  }

  const extra = leftovers(detail, consumed);
  if (extra) sections.push(extra);
  return sections;
};
