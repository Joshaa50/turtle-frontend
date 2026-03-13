
/**
 * Standard icons as Base64 strings for BYTEA database compatibility.
 * These are high-quality SVG icons themed for Turtle Conservation.
 */

const toBase64 = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

const ICON_COLOR = "#10b981"; // Emerald 500

const HATCHLING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 13v5"/><path d="M9 15l-3 1"/><path d="M15 15l3 1"/><path d="M10 18l-2 2"/><path d="M14 18l2 2"/></svg>`;

const COMPASS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/></svg>`;

const DATA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>`;

const THERMOMETER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><circle cx="12" cy="18" r="1"/></svg>`;

const CAMERA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="8" rx="2"/><path d="M9 8V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3"/><circle cx="12" cy="14" r="3"/></svg>`;

const WAVES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C5.8 7 7 6 7 6s1.2-1 2.5-1C10.8 5 12 6 12 6s1.2 1 2.5 1C15.8 7 17 6 17 6s1.2-1 2.5-1C20.8 5 22 6 22 6"/><path d="M2 12c.6.5 1.2 1 2.5 1 1.3 0 2.5-1 2.5-1s1.2-1 2.5-1C10.8 11 12 12 12 12s1.2 1 2.5 1c1.3 0 2.5-1 2.5-1s1.2-1 2.5-1C20.8 11 22 12 22 12"/><path d="M2 18c.6.5 1.2 1 2.5 1 1.3 0 2.5-1 2.5-1s1.2-1 2.5-1C10.8 17 12 18 12 18s1.2 1 2.5 1c1.3 0 2.5-1 2.5-1s1.2-1 2.5-1C20.8 17 22 18 22 18"/></svg>`;

const SHIELD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

export const STANDARD_ICONS = [
  { name: 'Hatchling', data: toBase64(HATCHLING_SVG) },
  { name: 'Compass', data: toBase64(COMPASS_SVG) },
  { name: 'Data', data: toBase64(DATA_SVG) },
  { name: 'Climate', data: toBase64(THERMOMETER_SVG) },
  { name: 'Field Photo', data: toBase64(CAMERA_SVG) },
  { name: 'Wave', data: toBase64(WAVES_SVG) },
  { name: 'Conservation', data: toBase64(SHIELD_SVG) },
  { name: 'Location', data: toBase64(PIN_SVG) },
];

export const DEFAULT_AVATAR = STANDARD_ICONS[0].data;
