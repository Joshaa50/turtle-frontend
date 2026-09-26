/**
 * How long a shift lasts, for the volunteer-hours report.
 *
 * A shift template carries a start and (sometimes) an end time. Morning survey
 * shifts are open-ended in the database - there is no end time - so counting
 * only templates that have both left most volunteers at "0.0h+". A report that
 * feeds a volunteer certificate or a funder cannot say zero for someone who
 * turned up, so a shift with no recorded length is given its type's default
 * and flagged as an estimate rather than dropped.
 */

export type ShiftKind = 'Morning' | 'Afternoon' | 'Night' | 'All Day' | string;

/** Used only when the shift's own template has no end time. Edit to suit the project. */
export const DEFAULT_SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  Morning: { start: '06:00', end: '09:30' },
  Afternoon: { start: '17:00', end: '19:00' },
  Night: { start: '21:00', end: '01:00' },
  'All Day': { start: '06:00', end: '19:00' },
};

const toMinutes = (t: string): number | null => {
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

/**
 * Hours between two "HH:MM" / "HH:MM:SS" times, across midnight if need be.
 * Null when either is missing or unreadable.
 */
export const shiftHours = (startTime?: string | null, endTime?: string | null): number | null => {
  if (!startTime || !endTime) return null;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return null;
  const diff = end >= start ? end - start : 24 * 60 - start + end;
  return diff / 60;
};

export interface ResolvedShiftHours {
  hours: number | null;
  /** True when the hours come from the type's default, not from the shift's own times. */
  estimated: boolean;
}

/**
 * The template's own times win. A template with a start but no end (the
 * morning survey) takes the default length for its type.
 */
export const resolveShiftHours = (
  template: { start_time?: string | null; end_time?: string | null } | undefined,
  shiftType: ShiftKind
): ResolvedShiftHours => {
  const own = shiftHours(template?.start_time, template?.end_time);
  if (own !== null) return { hours: own, estimated: false };

  const fallback = DEFAULT_SHIFT_TIMES[shiftType];
  if (!fallback) return { hours: null, estimated: false };
  return { hours: shiftHours(fallback.start, fallback.end), estimated: true };
};
