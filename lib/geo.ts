/**
 * Plausibility checks on nest positions.
 *
 * These only ever warn. A GPS fix can be poor, a beach can be long, and a nest
 * relocated above the storm line is legitimately away from where it was laid -
 * so nothing here blocks a save. What they catch is the case a person cannot
 * see at a glance: a pin that is kilometres inland, or a triangulation point
 * whose stated distance bears no relation to its coordinates.
 */

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in metres. */
export const distanceMetres = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** How far from a beach's reference point a nest may sit before it is queried. */
export const DEFAULT_BEACH_RADIUS_M = 200;

export interface BeachReference {
  name: string;
  gps_lat?: number | string | null;
  gps_long?: number | string | null;
  radius_m?: number | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * A warning if the position is farther from the beach's reference point than
 * the beach allows; null if it is fine, or if the beach has no reference point
 * to check against (an unchecked beach is not a failed one).
 */
export const beachLocationWarning = (
  beach: BeachReference | undefined | null,
  lat: unknown,
  lng: unknown
): string | null => {
  const bLat = num(beach?.gps_lat);
  const bLng = num(beach?.gps_long);
  const pLat = num(lat);
  const pLng = num(lng);
  if (!beach || bLat === null || bLng === null || pLat === null || pLng === null) return null;

  const limit = beach.radius_m && beach.radius_m > 0 ? beach.radius_m : DEFAULT_BEACH_RADIUS_M;
  const away = distanceMetres(bLat, bLng, pLat, pLng);
  if (away <= limit) return null;

  const shown = away >= 1000 ? `${(away / 1000).toFixed(1)} km` : `${Math.round(away)} m`;
  return `This position is about ${shown} from ${beach.name} (more than ${limit} m). Check the coordinates, or the beach.`;
};

/**
 * A warning if a triangulation point's stated distance to the nest does not
 * match the distance its own coordinates give. Allows the larger of 5 m or 25%,
 * since a handheld fix wanders a few metres and the tape is read by eye.
 */
export const triangulationWarning = (
  nestLat: unknown,
  nestLng: unknown,
  pointLat: unknown,
  pointLng: unknown,
  statedMetres: unknown
): string | null => {
  const nLat = num(nestLat);
  const nLng = num(nestLng);
  const pLat = num(pointLat);
  const pLng = num(pointLng);
  const stated = num(statedMetres);
  if (nLat === null || nLng === null || pLat === null || pLng === null || stated === null) return null;

  const actual = distanceMetres(nLat, nLng, pLat, pLng);
  const tolerance = Math.max(5, stated * 0.25);
  if (Math.abs(actual - stated) <= tolerance) return null;

  return `Stated as ${stated} m from the nest, but these coordinates are about ${Math.round(actual)} m away.`;
};
