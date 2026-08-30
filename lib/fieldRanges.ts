// What a field number is allowed to be.
//
// This mirrors the "Numeric bounds" section of turtle-backend/server.js, which
// is what actually protects the database - everything the browser downloads is
// public, so the form can never be the thing that decides what gets stored.
// These exist so a mistyped count is caught beside the field that produced it,
// named, and before a patrol's submit fails; not as a substitute for the API's
// own check.
//
// They are hard "cannot be true" limits, deliberately generous: the aim is to
// stop -75 hatchlings and a 999-metre carapace, not to argue with a real
// outlier someone actually measured.

export interface NumericRange {
  min: number;
  max: number;
}

export const FIELD_RANGES = {
  /** Eggs in one clutch; the largest recorded loggerhead nest is around 200. */
  eggs: { min: 0, max: 300 },
  /** Hatchling tracks and excavation tallies from a single nest. */
  tracks: { min: 0, max: 1000 },
  /** Carapace and tail measurements in cm; a leatherback reaches about 180. */
  measurement: { min: 0, max: 250 },
} as const satisfies Record<string, NumericRange>;

/**
 * The problem with `raw`, or null if there isn't one.
 *
 * Blank is not an error here - "not measured" is a legitimate answer for most
 * of these fields, and whether a field is required is a separate question.
 */
export const rangeError = (
  label: string,
  raw: string | number | null | undefined,
  range: NumericRange
): string | null => {
  if (raw === '' || raw === null || raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    return `${label} must be a number between ${range.min} and ${range.max}`;
  }
  return null;
};
