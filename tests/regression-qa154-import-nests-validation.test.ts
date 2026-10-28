// Regression (QA-154): Import Nests accepted values the manual Nest Entry
// form blocks - 9,999 eggs, h deeper than H, a 250cm width, and GPS ~1,100km
// from the beach all showed up as "ready to import" with zero problems. Nest
// Entry already enforces eggs 0-300, "need h < H", and warns on an
// implausible GPS fix (lib/geo.ts); parseNestCsv now runs the same checks so
// a CSV cannot slip past what a hand-typed nest cannot.
import { describe, it, expect } from 'vitest';
import { parseNestCsv } from '../lib/csvImport';

const HEAD = 'nest_code,beach,date_found,gps_lat,gps_long,distance_to_sea_s,depth_top_egg_h,total_num_eggs,depth_bottom_chamber_h,width_w';
const BEACHES = ['Lepeda'];
// Lepeda's own reference point, close to the good row's coordinates.
const BEACH_LOCATIONS = [{ name: 'Lepeda', gps_lat: 38.17790, gps_long: 20.43975, radius_m: 200 }];

const issuesFor = (row: string) =>
  parseNestCsv(`${HEAD}\n${row}`, BEACHES, BEACH_LOCATIONS).issues;

describe('parseNestCsv (QA-154)', () => {
  it('flags a clutch of 9,999 eggs instead of marking the row ready', () => {
    const issues = issuesFor('LP-2019-3,Lepeda,2019-06-14,38.17790,20.43975,15,60,9999,19,22');
    expect(issues.some((i) => i.field === 'total_num_eggs')).toBe(true);
  });

  it('flags depth_top_egg_h (h) deeper than depth_bottom_chamber_h (H)', () => {
    // h=60, H=19 - the chamber floor is above its own ceiling.
    const issues = issuesFor('LP-2019-3,Lepeda,2019-06-14,38.17790,20.43975,15,60,96,19,22');
    expect(issues.some((i) => /depth logic/i.test(i.message))).toBe(true);
  });

  it('flags an implausible 250cm width', () => {
    const issues = issuesFor('LP-2019-3,Lepeda,2019-06-14,38.17790,20.43975,15,20,96,55,250');
    expect(issues.some((i) => i.field === 'width_w')).toBe(true);
  });

  it('flags GPS roughly 1,100km from the named beach', () => {
    // 48.17790 instead of 38.17790 - same longitude, ten degrees of latitude
    // off, which is roughly 1,100km on this part of the globe.
    const issues = issuesFor('LP-2019-4,Lepeda,2019-06-15,48.17790,20.43975,15,20,96,55,22');
    expect(issues.some((i) => i.field === 'gps_lat')).toBe(true);
  });

  it('still accepts a plausible row (no regression on the good path)', () => {
    const { rows, issues } = parseNestCsv(
      `${HEAD}\nLP-2019-5,Lepeda,2019-06-16,38.17800,20.43980,15,20,96,55,22`,
      BEACHES,
      BEACH_LOCATIONS
    );
    expect(issues).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });
});
