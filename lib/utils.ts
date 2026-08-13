import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const digitsOf = (value: string) => value.replace(/\D/g, '');

/** Renders up to four raw digits as `HH:MM`, colon appearing once minutes start. */
export function formatTimeDigits(digits: string): string {
  const d = digitsOf(digits).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

/**
 * Applies one typed digit to a `HH:MM` field, left to right.
 *
 * Two rules keep field entry predictable:
 *
 * - Once four digits are present the field is full, so the next digit starts a
 *   fresh time. Previously it was appended and then truncated away, which meant
 *   typing into a field that already had a value silently did nothing (or
 *   scrambled it, when typing mid-field).
 * - A digit that cannot be a tens place is shifted into the units place instead:
 *   typing `9` for the hour gives `09`, not a dead keystroke. Digits that can
 *   only ever be invalid (`25:` and up) are rejected rather than accepted and
 *   left for the user to notice later.
 */
export function applyTimeDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit)) return current;
  const existing = digitsOf(current);
  const d = Number(digit);

  // Field already complete — start a new entry.
  if (existing.length >= 4) return formatTimeDigits(d > 2 ? `0${digit}` : digit);

  switch (existing.length) {
    case 0: // hour tens: 3-9 can only mean 03-09
      return formatTimeDigits(d > 2 ? `0${digit}` : digit);
    case 1: // hour units: reject 24-29
      if (existing === '2' && d > 3) return current;
      return formatTimeDigits(existing + digit);
    case 2: // minute tens: 6-9 can only mean 06-09
      return formatTimeDigits(existing + (d > 5 ? `0${digit}` : digit));
    default:
      return formatTimeDigits(existing + digit);
  }
}

/**
 * Props for a masked `HH:MM` text field, spread onto any `<input>`.
 *
 * A plain function rather than a hook, so it stays legal inside the `.map()`
 * that renders the tagging screen's time rows.
 *
 * Edits are worked out by diffing the digits before and after the browser
 * applied them, rather than by reading `event.key`. Virtual keyboards routinely
 * report `Unidentified` for key presses, and these screens are used on phones in
 * the field, so a keydown-based mask would misbehave exactly where it matters
 * most. Diffing also covers paste, autofill and dictation for free.
 */
export function timeInputProps(
  value: string,
  onChange: (next: string) => void,
  options?: { onBlur?: () => void }
) {
  return {
    // `numeric` rather than `type="number"`: brings up the digit keypad on
    // phones without the spinner and scroll-to-change behaviour of a number
    // input.
    inputMode: 'numeric' as const,
    value,
    onChange: (e: { target: { value: string } }) => {
      const before = digitsOf(value);
      const after = digitsOf(e.target.value);

      if (after.length <= before.length) {
        // Deletion, or a selection replaced by fewer digits. The browser's
        // result is already what the user meant — just re-apply the mask.
        onChange(formatTimeDigits(after));
        return;
      }

      // Digits were added. Locate them by walking past the common prefix, then
      // feed each through the mask so the range rules apply.
      let i = 0;
      while (i < before.length && before[i] === after[i]) i++;
      const added = after.slice(i, i + (after.length - before.length));
      onChange(added.split('').reduce(applyTimeDigit, value));
    },
    onBlur: () => {
      const completed = completeTimeInput(value);
      if (completed !== value) onChange(completed);
      options?.onBlur?.();
    },
  };
}

/**
 * Pads a part-typed time on blur: `9` becomes `09:00`, `93` becomes `09:30`.
 * Also clamps anything out of range that slipped through (e.g. a paste).
 */
export function completeTimeInput(current: string): string {
  const d = digitsOf(current).slice(0, 4);
  if (!d) return '';
  // The two halves pad in opposite directions, matching how the mask fills them:
  // a lone hour digit is the units place (`9` -> 09), while a lone minute digit
  // is the tens place (`10:3` -> 10:30).
  const hours = Math.min(23, Number(d.slice(0, 2).padStart(2, '0')));
  const minutes = Math.min(59, Number(d.slice(2).padEnd(2, '0')));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Renders an ISO date (or the date half of an ISO timestamp) as DD/MM/YYYY for
// display. Parsed off the string rather than via `new Date()` so a bare
// "2026-08-12" isn't shifted a day by the local timezone.
export function formatDateDisplay(value?: string | null): string {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

// One convention for coordinate inputs across the whole app. The reference pair
// is Kefalonia (Lixouri station), matching the beaches the project surveys.
export const COORD_PLACEHOLDER = { lat: '38.xxxxx', lng: '20.xxxxx' } as const;
export const COORD_LABEL = { lat: 'Lat', lng: 'Lng' } as const;

// Cryptographically random temporary password: avoids ambiguous characters (0/O, 1/l/I).
export function generateTempPassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// Species are stored as scientific names (matching existing legacy records) so
// filtering/grouping/reporting by species works across old and new data.
// Forms should use SPECIES_OPTIONS' values; anything else is normalized on read.
export const SPECIES_OPTIONS = [
  { value: 'Caretta caretta', label: 'Loggerhead (Caretta caretta)' },
  { value: 'Chelonia mydas', label: 'Green (Chelonia mydas)' },
] as const;

export function getCommonSpeciesName(raw?: string | null): string {
  if (!raw) return 'Unknown';
  const s = raw.trim().toLowerCase();
  if (s.includes('caretta') || s === 'loggerhead') return 'Loggerhead';
  if (s.includes('mydas') || s === 'green') return 'Green';
  if (s.includes('coriacea') || s === 'leatherback') return 'Leatherback';
  return raw;
}

// Maps any legacy value (either casing of scientific name, or old common-name
// records like "Loggerhead"/"Green") to the canonical stored value.
export function normalizeSpeciesValue(raw?: string | null): string {
  if (!raw) return SPECIES_OPTIONS[0].value;
  const s = raw.trim().toLowerCase();
  if (s.includes('caretta') || s === 'loggerhead') return 'Caretta caretta';
  if (s.includes('mydas') || s === 'green') return 'Chelonia mydas';
  if (s.includes('coriacea') || s === 'leatherback') return 'Dermochelys coriacea';
  return raw;
}

// Downloads an array of flat objects as a CSV file (client-side, no backend involved).
export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return;

  const headerSet = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);

  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
