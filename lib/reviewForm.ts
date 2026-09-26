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
    if (nests.length) {
      sections.push({
        title: `Nests on this survey (${nests.length})`,
        rows: nests.map((n) => ({
          label: String(n.nest_code ?? 'Nest'),
          value: [
            isEmpty(n.total_num_eggs) ? null : `${n.total_num_eggs} eggs`,
            n.status,
            isEmpty(n.date_found) ? null : `found ${formatValue('date_found', n.date_found)}`,
          ].filter((x) => !isEmpty(x)).join(' · ') || '—',
        })),
      });
    }
    if (emergences.length) {
      sections.push({
        title: `Emergences on this survey (${emergences.length})`,
        rows: emergences.map((e, i) => ({
          label: `Emergence ${i + 1}`,
          value: [
            e.beach,
            isEmpty(e.event_date) ? null : formatValue('event_date', e.event_date),
            isEmpty(e.distance_to_sea_s) ? null : formatValue('distance_to_sea_s', e.distance_to_sea_s),
          ].filter((x) => !isEmpty(x)).join(' · ') || '—',
        })),
      });
    }
  }

  const extra = leftovers(detail, consumed);
  if (extra) sections.push(extra);
  return sections;
};
