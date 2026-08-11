import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeInput(value: string): string {
  const rawValue = value.replace(/\D/g, '');
  let formatted = rawValue;
  if (formatted.length > 4) formatted = formatted.slice(0, 4);
  if (formatted.length > 2) {
    formatted = `${formatted.slice(0, 2)}:${formatted.slice(2)}`;
  }
  return formatted;
}

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
