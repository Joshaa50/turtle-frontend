import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

// GD-009: every page -- including pre-login/public ones -- used to load fonts
// and images straight from fonts.googleapis.com, lh3.googleusercontent.com,
// and img.icons8.com, leaking each visitor's IP to those third parties before
// any login or consent. Fonts and images now ship self-hosted (@fontsource
// packages, public/ocean-hero.png, public/icons/*.png). This guard fails
// loudly if any of those hostnames creep back into the files that used to
// reference them.
describe('no third-party asset hosts in self-hosted files (GD-009)', () => {
  const root = path.resolve(__dirname, '..');

  const thirdPartyHosts = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'lh3.googleusercontent.com',
    'img.icons8.com',
  ];

  const filesToCheck = [
    'index.html',
    'src/index.css',
    'screens/Login.tsx',
    'screens/PublicStats.tsx',
    'components/Sidebar.tsx',
    'screens/Dashboard.tsx',
  ];

  it.each(filesToCheck)('%s references no third-party asset host', (relativePath) => {
    const contents = fs.readFileSync(path.resolve(root, relativePath), 'utf-8');

    for (const host of thirdPartyHosts) {
      expect(contents).not.toContain(host);
    }
  });
});
