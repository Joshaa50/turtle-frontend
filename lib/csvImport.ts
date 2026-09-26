/**
 * Reading a historical nest spreadsheet into the app.
 *
 * Every row is submitted through the same POST /nests/create a hand-typed
 * nest goes through, so an import cannot slip past the numeric bounds, the
 * role checks or the audit trail. That costs one request per row, which is
 * the right trade: a bulk path that bypassed validation would let a decade of
 * unchecked data in through a door the forms keep shut.
 *
 * Parsing and checking are separated from sending so the screen can show
 * exactly what will happen before anything is written.
 */

export interface ImportIssue {
  /** 1-based row number as the spreadsheet shows it, header counted. */
  row: number;
  field?: string;
  message: string;
}

export interface ParsedNest {
  row: number;
  nest_code: string;
  beach: string;
  date_found: string;
  gps_lat: number;
  gps_long: number;
  distance_to_sea_s: number;
  depth_top_egg_h: number;
  total_num_eggs?: number;
  depth_bottom_chamber_h?: number;
  width_w?: number;
  status?: string;
  notes?: string;
}

export interface ParseResult {
  rows: ParsedNest[];
  issues: ImportIssue[];
  /** Headers found that the importer does not use, so they are not silently dropped. */
  unknownColumns: string[];
}

/** Columns POST /nests/create refuses a nest without. */
export const REQUIRED_COLUMNS = [
  'nest_code', 'beach', 'date_found',
  'gps_lat', 'gps_long', 'distance_to_sea_s', 'depth_top_egg_h',
] as const;

export const OPTIONAL_COLUMNS = [
  'total_num_eggs', 'depth_bottom_chamber_h', 'width_w', 'status', 'notes',
] as const;

const KNOWN = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

/**
 * Splits CSV text into rows of cells.
 *
 * Hand-rolled rather than split(',') because a notes column will contain
 * commas and quotes the moment anyone types a real observation into it, and a
 * naive split silently shifts every column after it - producing rows that
 * import successfully with the wrong values in them.
 */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  // Strip a BOM: Excel writes one, and it would otherwise become part of the
  // first header name and stop it matching.
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }  // escaped quote
        else inQuotes = false;
      } else cell += ch;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }

  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
};

const num = (raw: string): number | null => {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Accepts YYYY-MM-DD, and DD/MM/YYYY because that is what a European field
 * spreadsheet holds. Ambiguous US-style MM/DD/YYYY is NOT guessed at: reading
 * 05/06/2024 as the wrong month would move a nest a month through its
 * incubation and nobody would ever notice.
 */
export const normaliseDate = (raw: string): string | null => {
  const t = raw.trim();
  if (!t) return null;

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;

  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = Number(d), month = Number(m);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
};

export const parseNestCsv = (text: string, knownBeaches: string[] = []): ParseResult => {
  const table = parseCsv(text);
  const issues: ImportIssue[] = [];

  if (table.length === 0) {
    return { rows: [], issues: [{ row: 0, message: 'The file is empty.' }], unknownColumns: [] };
  }

  const headers = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return {
      rows: [],
      issues: [{ row: 1, message: `Missing required ${missing.length === 1 ? 'column' : 'columns'}: ${missing.join(', ')}` }],
      unknownColumns: [],
    };
  }

  const unknownColumns = headers.filter((h) => h !== '' && !KNOWN.has(h));
  const at = (cells: string[], col: string) => (cells[headers.indexOf(col)] ?? '').trim();

  // Beach names are matched case-insensitively against the configured list,
  // but never invented: a typo that silently created "Loggos2" as a new beach
  // would split a season's records across two names.
  const beachLookup = new Map(knownBeaches.map((b) => [b.toLowerCase(), b]));

  const rows: ParsedNest[] = [];
  const seenCodes = new Set<string>();

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const rowNo = r + 1;
    const problem = (message: string, field?: string) => issues.push({ row: rowNo, field, message });
    const before = issues.length;

    const nest_code = at(cells, 'nest_code');
    if (!nest_code) problem('Nest code is required', 'nest_code');
    else if (seenCodes.has(nest_code.toLowerCase())) {
      problem(`Nest code "${nest_code}" appears more than once in this file`, 'nest_code');
    }

    const rawBeach = at(cells, 'beach');
    let beach = rawBeach;
    if (!rawBeach) problem('Beach is required', 'beach');
    else if (knownBeaches.length > 0) {
      const matched = beachLookup.get(rawBeach.toLowerCase());
      if (!matched) problem(`"${rawBeach}" is not one of your beaches — add it first, or correct the spelling`, 'beach');
      else beach = matched;
    }

    const date_found = normaliseDate(at(cells, 'date_found'));
    if (!date_found) problem('Date must be YYYY-MM-DD or DD/MM/YYYY', 'date_found');

    const numeric: Record<string, number | null> = {};
    for (const col of ['gps_lat', 'gps_long', 'distance_to_sea_s', 'depth_top_egg_h'] as const) {
      numeric[col] = num(at(cells, col));
      if (numeric[col] === null) problem(`${col} is required and must be a number`, col);
    }
    for (const col of ['total_num_eggs', 'depth_bottom_chamber_h', 'width_w'] as const) {
      const raw = at(cells, col);
      if (raw !== '') {
        numeric[col] = num(raw);
        if (numeric[col] === null) problem(`${col} must be a number`, col);
      }
    }

    if (issues.length !== before) continue;   // don't build a row we rejected

    seenCodes.add(nest_code.toLowerCase());
    rows.push({
      row: rowNo,
      nest_code,
      beach,
      date_found: date_found!,
      gps_lat: numeric.gps_lat!,
      gps_long: numeric.gps_long!,
      distance_to_sea_s: numeric.distance_to_sea_s!,
      depth_top_egg_h: numeric.depth_top_egg_h!,
      ...(numeric.total_num_eggs != null ? { total_num_eggs: numeric.total_num_eggs } : {}),
      ...(numeric.depth_bottom_chamber_h != null ? { depth_bottom_chamber_h: numeric.depth_bottom_chamber_h } : {}),
      ...(numeric.width_w != null ? { width_w: numeric.width_w } : {}),
      ...(at(cells, 'status') ? { status: at(cells, 'status').toLowerCase() } : {}),
      ...(at(cells, 'notes') ? { notes: at(cells, 'notes') } : {}),
    });
  }

  return { rows, issues, unknownColumns };
};

/** A blank file with the headers, so nobody has to guess the column names. */
export const importTemplateCsv = (): string =>
  [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(',') + '\n';
