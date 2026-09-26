/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * Not a nicety: a modern phone camera produces 3-8MB, base64 inflates that by
 * a third, and the API accepts a 10MB body — so a single unmodified photo can
 * fail outright. Beyond that, a field team uploads over patchy mobile data at
 * dawn, and a 6MB upload that times out halfway is worse than a 400KB one that
 * lands.
 *
 * Resolution is capped rather than quality alone: 1600px on the long edge is
 * enough to see a cage, a predated chamber or a flipper tag, which is what
 * these photographs are for.
 */

export const MAX_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.82;

export interface DownscaledImage {
  /** Bare base64, no data-URL prefix — what the API expects. */
  base64: string;
  mimeType: 'image/jpeg';
  bytes: number;
  width: number;
  height: number;
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });

export const downscaleImage = async (
  file: File,
  maxEdge: number = MAX_EDGE_PX
): Promise<DownscaledImage> => {
  const img = await loadImage(file);

  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  // Never scale up: a small photo re-encoded larger gains nothing and costs
  // bytes.
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not process the image.');
  ctx.drawImage(img, 0, 0, width, height);

  // JPEG regardless of what came in: these are photographs, and a PNG of a
  // beach is several times the size for no visible gain.
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.split(',')[1] ?? '';

  return {
    base64,
    mimeType: 'image/jpeg',
    // Base64 carries 3 bytes per 4 characters; padding is not data.
    bytes: Math.round((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0),
    width,
    height,
  };
};
