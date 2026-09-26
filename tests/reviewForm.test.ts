import { describe, it, expect } from 'vitest';
import { buildFormSections, humaniseKey } from '../lib/reviewForm';

const rowsOf = (sections: ReturnType<typeof buildFormSections>, title: string) =>
  Object.fromEntries((sections.find((s) => s.title === title)?.rows ?? []).map((r) => [r.label, r.value]));

describe('buildFormSections', () => {
  it('returns nothing when the record could not be loaded', () => {
    expect(buildFormSections('nest_event', null)).toEqual([]);
    expect(buildFormSections('nest_event', undefined)).toEqual([]);
  });

  it('shows a whole inventory, not just its headline figures', () => {
    const sections = buildFormSections('nest_event', {
      id: 7, nest_id: 3, event_type: 'PARTIAL_INVENTORY', nest_code: 'LG2-9', observer: 'Sam',
      original_depth_top_egg_h: 40, original_gps_lat: 38.12345, original_gps_long: 20.54321,
      total_eggs: 100, eggs_reburied: 12,
      hatched_count: 80, hatched_black_fungus_count: 2, hatched_pink_bacteria_count: 1,
      late_count: 5,
      reburied_width_w: 30,
      notes: 'Roots through the chamber',
    });
    expect(rowsOf(sections, 'Event')).toEqual({ 'Event type': 'partial inventory', 'Nest code': 'LG2-9', Observer: 'Sam' });
    expect(rowsOf(sections, 'Original nest measurements')).toMatchObject({
      'Original depth top egg': '40',
      GPS: '38.12345, 20.54321',
    });
    expect(rowsOf(sections, 'Eggs and hatchlings')).toMatchObject({ 'Total eggs': '100', 'Eggs reburied': '12' });
    expect(rowsOf(sections, 'Embryo stages and infection')).toEqual({
      Hatched: '80 (black fungus 2, pink bacteria 1)',
      Late: '5',
    });
    expect(rowsOf(sections, 'Reburied nest measurements')).toEqual({ 'Reburied width': '30' });
    expect(rowsOf(sections, 'Notes')).toEqual({ Notes: 'Roots through the chamber' });
  });

  it('never shows internal ids', () => {
    const all = buildFormSections('nest_event', { id: 7, nest_id: 3, total_eggs: 10 }).flatMap((s) => s.rows);
    expect(all.map((r) => r.label)).toEqual(['Total eggs']);
  });

  it('puts unknown columns under Other details rather than dropping them', () => {
    const sections = buildFormSections('nest_event', { total_eggs: 10, brand_new_column: 'x' });
    expect(rowsOf(sections, 'Other details')).toEqual({ 'Brand new column': 'x' });
  });

  it('shows a tagging with its tags, measurements and each sighting', () => {
    const sections = buildFormSections('turtle', {
      id: 1, name: 'Gaia', species: 'Caretta caretta', sex: 'female',
      front_left_tag: 'AB123', front_left_address: 'Tag base', scl_max: 78.5,
      survey_events: [
        { id: 9, turtle_id: 1, event_date: '2026-06-02', event_type: 'NESTING', location: 'Lixouri', total_tail_length: 30 },
      ],
    });
    expect(rowsOf(sections, 'Animal')).toMatchObject({ Name: 'Gaia', Species: 'Caretta caretta' });
    expect(rowsOf(sections, 'Tags')).toEqual({ 'Front left tag': 'AB123 · Tag base' });
    expect(rowsOf(sections, 'Measurements')).toEqual({ 'SCL max': '78.5' });
    const sighting = sections.find((s) => s.title.startsWith('Sighting 1'));
    expect(sighting?.rows.map((r) => r.label)).toEqual(expect.arrayContaining(['Event type', 'Location', 'Total tail length']));
  });

  it('shows a morning survey with the nests and emergences it covered', () => {
    const sections = buildFormSections('morning_survey', {
      id: 2, beach_id: 1, beach: 'Lixouri', survey_date: '2026-06-03',
      start_time: '06:00:00', end_time: '07:30:00', protected_nest_count: 3,
      linked_nests: [{ nest_code: 'LG2-9', total_num_eggs: 104, status: 'Incubating' }],
      linked_emergences: [{ beach: 'Lixouri', distance_to_sea_s: 12 }],
    });
    expect(rowsOf(sections, 'Survey')).toMatchObject({ Times: '06:00 – 07:30', 'Protected nest count': '3' });
    expect(rowsOf(sections, 'Nests on this survey (1)')).toEqual({ 'LG2-9': '104 eggs · Incubating' });
    expect(rowsOf(sections, 'Emergences on this survey (1)')).toEqual({ 'Emergence 1': 'Lixouri · 12 m' });
    expect(sections.find((s) => s.title === 'Other details')).toBeUndefined();
  });
});

describe('humaniseKey', () => {
  it('turns column names into labels', () => {
    expect(humaniseKey('distance_to_sea_s')).toBe('Distance to sea');
    expect(humaniseKey('has_track_sketch')).toBe('Track sketch');
    expect(humaniseKey('tri_tl_desc')).toBe('Tri top-left description');
  });
});
