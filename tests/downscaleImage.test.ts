import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downscaleImage, MAX_EDGE_PX } from '../lib/downscaleImage';

// jsdom has no real canvas or image decoding, so both are stubbed to report
// the dimensions a given file "has". What is under test is the arithmetic that
// decides the output size, and the base64 the API receives.
let drawn: { w: number; h: number } | null = null;

const stubImage = (naturalWidth: number, naturalHeight: number) => {
  class FakeImage {
    naturalWidth = naturalWidth;
    naturalHeight = naturalHeight;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
  }
  vi.stubGlobal('Image', FakeImage as any);
};

beforeEach(() => {
  drawn = null;
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} } as any);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as any;
    return {
      width: 0, height: 0,
      getContext: () => ({ drawImage: (_i: any, _x: number, _y: number, w: number, h: number) => { drawn = { w, h }; } }),
      // 12 base64 chars -> 9 bytes, enough to assert the byte maths.
      toDataURL: () => 'data:image/jpeg;base64,QUJDREVGR0hJSks=',
    } as any;
  }) as any);
});

const file = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

describe('downscaleImage', () => {
  it('caps the long edge and keeps the aspect ratio', async () => {
    stubImage(4000, 3000);
    const out = await downscaleImage(file());
    expect(out.width).toBe(MAX_EDGE_PX);
    expect(out.height).toBe(Math.round(3000 * (MAX_EDGE_PX / 4000)));
    expect(drawn).toEqual({ w: out.width, h: out.height });
  });

  it('caps the long edge when the photo is portrait', async () => {
    stubImage(3000, 4000);
    const out = await downscaleImage(file());
    expect(out.height).toBe(MAX_EDGE_PX);
    expect(out.width).toBe(Math.round(3000 * (MAX_EDGE_PX / 4000)));
  });

  it('never scales a small photo up', async () => {
    // Re-encoding a 400px image at 1600 gains nothing and costs bytes.
    stubImage(400, 300);
    const out = await downscaleImage(file());
    expect(out.width).toBe(400);
    expect(out.height).toBe(300);
  });

  it('returns bare base64, not a data URL, because that is what the API takes', async () => {
    stubImage(2000, 1000);
    const out = await downscaleImage(file());
    expect(out.base64).not.toMatch(/^data:/);
    expect(out.base64).toBe('QUJDREVGR0hJSks=');
  });

  it('always outputs JPEG — a PNG of a beach is several times the size', async () => {
    stubImage(2000, 1000);
    expect((await downscaleImage(file())).mimeType).toBe('image/jpeg');
  });

  it('reports decoded bytes, not base64 characters', async () => {
    stubImage(2000, 1000);
    // 'QUJDREVGR0hJSks=' is 16 chars with one pad -> 11 bytes.
    expect((await downscaleImage(file())).bytes).toBe(11);
  });

  it('honours a custom max edge', async () => {
    stubImage(4000, 2000);
    expect((await downscaleImage(file(), 800)).width).toBe(800);
  });

  it('explains itself when the file is not a readable image', async () => {
    class BadImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { setTimeout(() => this.onerror?.(), 0); }
    }
    vi.stubGlobal('Image', BadImage as any);
    await expect(downscaleImage(file())).rejects.toThrow(/could not be read as an image/i);
  });
});
