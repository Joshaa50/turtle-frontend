/**
 * Stations are stored by their short code ("Lix", "Argo") because that is what
 * accounts and beaches carry, but a code means nothing to someone reading a
 * list. This gives the name people use. A station with no entry here shows as
 * it was typed, so another organisation's stations still display correctly.
 */
const KNOWN_STATIONS: Record<string, string> = {
  lix: 'Lixouri',
  argo: 'Argostoli',
};

export const stationLabel = (station: string | null | undefined): string => {
  const raw = (station || '').trim();
  if (!raw) return '';
  const full = KNOWN_STATIONS[raw.toLowerCase()];
  return full && full.toLowerCase() !== raw.toLowerCase() ? `${full} (${raw})` : raw;
};
