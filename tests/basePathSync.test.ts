import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

// QA-037: the GitHub Pages base path '/turtle-frontend/' is hardcoded
// independently in vite.config.ts, index.html, and public/404.html with no
// single source of truth. Nothing enforces that they stay in sync, so this
// guard test fails loudly if any one of them drifts from the others.
describe('GitHub Pages base path stays in sync across config/HTML shims (QA-037)', () => {
  const root = path.resolve(__dirname, '..');

  const viteConfig = fs.readFileSync(path.resolve(root, 'vite.config.ts'), 'utf-8');
  const indexHtml = fs.readFileSync(path.resolve(root, 'index.html'), 'utf-8');
  const notFoundHtml = fs.readFileSync(path.resolve(root, 'public', '404.html'), 'utf-8');

  const viteBaseMatch = viteConfig.match(/base:\s*'([^']+)'/);
  const indexBaseMatch = indexHtml.match(/var base = '([^']+)'/);
  const notFoundBaseMatch = notFoundHtml.match(/var base = '([^']+)'/);

  it('finds a base path literal in each of the three files', () => {
    expect(viteBaseMatch).not.toBeNull();
    expect(indexBaseMatch).not.toBeNull();
    expect(notFoundBaseMatch).not.toBeNull();
  });

  it('uses the same base path literal in vite.config.ts, index.html, and public/404.html', () => {
    const viteBase = viteBaseMatch?.[1];
    const indexBase = indexBaseMatch?.[1];
    const notFoundBase = notFoundBaseMatch?.[1];

    expect(indexBase).toBe(viteBase);
    expect(notFoundBase).toBe(viteBase);
  });

  it('ends each base path with a trailing slash, as lib/routing.ts base() expects', () => {
    expect(viteBaseMatch?.[1].endsWith('/')).toBe(true);
    expect(indexBaseMatch?.[1].endsWith('/')).toBe(true);
    expect(notFoundBaseMatch?.[1].endsWith('/')).toBe(true);
  });
});
