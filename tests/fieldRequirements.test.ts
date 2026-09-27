import { describe, it, expect } from 'vitest';
import { isRequired, missingRequiredFields, defaultFieldRequirements, FIELD_SCHEMA } from '../lib/fieldRequirements';

describe('defaultFieldRequirements', () => {
  it('matches what the API has always accepted, field by field', () => {
    const d = defaultFieldRequirements();
    // Enforced by the backend since before this feature existed.
    expect(d.nest.gps).toBe('required');
    expect(d.nest.distance_to_sea_s).toBe('required');
    expect(d.turtle.measurements).toBe('required');
    // Only the manual-entry screens ever enforced these - the API never did.
    expect(d.emergence.gps).toBe('recommended');
    expect(d.nest_event.observer).toBe('recommended');
    expect(d.nest_event.reburied_measurements).toBe('recommended');
    expect(d.morning_survey.gps).toBe('recommended');
    // Never enforced anywhere.
    expect(d.turtle.front_left_tag).toBe('recommended');
    expect(d.nest.notes).toBe('recommended');
  });

  it('covers exactly the fields the backend allowlists, no more', () => {
    // A structural field must never appear here - there is nothing that
    // could ever make nest_code or event_type optional.
    for (const form of Object.keys(FIELD_SCHEMA) as (keyof typeof FIELD_SCHEMA)[]) {
      expect(FIELD_SCHEMA[form]['nest_code' as any]).toBeUndefined();
      expect(FIELD_SCHEMA[form]['event_type' as any]).toBeUndefined();
    }
  });
});

describe('isRequired', () => {
  it('falls back to the default when nothing is configured', () => {
    expect(isRequired(undefined, 'nest', 'gps')).toBe(true);
    expect(isRequired(undefined, 'emergence', 'gps')).toBe(false);
  });

  it('follows a configured level over the default', () => {
    const levels = defaultFieldRequirements();
    levels.nest.gps = 'recommended';
    expect(isRequired(levels, 'nest', 'gps')).toBe(false);
  });

  it('is false for a field outside the schema', () => {
    expect(isRequired(undefined, 'nest', 'not_a_real_field')).toBe(false);
  });

  it('gates reburied measurements on eggs actually having been reburied, unconditionally', () => {
    const levels = defaultFieldRequirements();
    levels.nest_event.reburied_measurements = 'required';
    expect(isRequired(levels, 'nest_event', 'reburied_measurements', { eggs_reburied: 0 })).toBe(false);
    expect(isRequired(levels, 'nest_event', 'reburied_measurements', { eggs_reburied: 12 })).toBe(true);
    // The gate itself cannot be turned off by configuration - there is no
    // level that requires it regardless of eggs_reburied.
    expect(isRequired(levels, 'nest_event', 'reburied_measurements', {})).toBe(false);
  });
});

describe('missingRequiredFields', () => {
  it('lists only the fields that are actually required and actually blank', () => {
    const levels = defaultFieldRequirements();
    const missing = missingRequiredFields(levels, 'nest', { gps_lat: 38.1, notes: '' });
    expect(missing.map((m) => m.field)).toEqual(expect.arrayContaining(['gps', 'distance_to_sea_s']));
    expect(missing.map((m) => m.field)).not.toContain('notes');
  });

  it('treats a GPS pair as one unit: half of it present is still missing', () => {
    const levels = defaultFieldRequirements();
    const missing = missingRequiredFields(levels, 'nest', { gps_lat: 38.1, gps_long: '', distance_to_sea_s: 10 });
    expect(missing.map((m) => m.field)).toEqual(['gps']);
  });

  it('finds nothing missing once every required field is present', () => {
    const levels = defaultFieldRequirements();
    const missing = missingRequiredFields(levels, 'emergence', {});
    expect(missing).toEqual([]); // every emergence field defaults to recommended
  });

  it('honours a loosened level', () => {
    const levels = defaultFieldRequirements();
    levels.turtle.measurements = 'recommended';
    expect(missingRequiredFields(levels, 'turtle', {})).toEqual([]);
  });
});
