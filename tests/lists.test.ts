import { describe, it, expect } from 'vitest';
import { speciesOptions, healthOptions, isConcerning } from '../lib/lists';
import { DatabaseConnection } from '../services/Database';

const defaults = DatabaseConnection.defaultSettings().lists;
const lists = {
  species: [
    { value: 'Caretta caretta', label: 'Loggerhead', active: true },
    { value: 'Old sp', label: 'Old one', active: false },
  ],
  health_conditions: [
    { value: 'Healthy', concerning: false, active: true },
    { value: 'Injured', concerning: true, active: true },
    { value: 'Sleepy', concerning: true, active: false },
  ],
};

describe('dropdown options', () => {
  it('offers only options in use', () => {
    expect(speciesOptions(lists).map((o) => o.value)).toEqual(['Caretta caretta']);
    expect(healthOptions(lists).map((o) => o.value)).toEqual(['Healthy', 'Injured']);
  });

  it('keeps the value a record already holds, marking it retired', () => {
    const opts = speciesOptions(lists, 'Old sp');
    expect(opts.map((o) => o.value)).toEqual(['Caretta caretta', 'Old sp']);
    expect(opts[1].label).toBe('Old one (retired)');
    expect(healthOptions(lists, 'Sleepy').pop()?.label).toBe('Sleepy (retired)');
  });

  it('keeps an old free-text value unchanged rather than swapping it', () => {
    expect(healthOptions(lists, 'Deceased').pop()).toEqual({ value: 'Deceased', label: 'Deceased' });
  });

  it('does not duplicate a value already offered, whatever its case', () => {
    expect(speciesOptions(lists, 'caretta caretta')).toHaveLength(1);
  });

  it('defaults match the options the forms always had', () => {
    expect(speciesOptions(defaults).map((o) => o.value)).toEqual(['Caretta caretta', 'Chelonia mydas']);
    expect(healthOptions(defaults).map((o) => o.value)).toEqual(['Healthy', 'Lethargic', 'Injured', 'Dead']);
  });
});

describe('isConcerning', () => {
  it('follows the coordinator\'s flag, retired or not', () => {
    expect(isConcerning(lists, 'Injured')).toBe(true);
    expect(isConcerning(lists, 'Sleepy')).toBe(true);
    expect(isConcerning(lists, 'Healthy')).toBe(false);
  });

  it('still counts the legacy Sick and Critical, so the dashboard figure does not drop', () => {
    expect(isConcerning(lists, 'Sick')).toBe(true);
    expect(isConcerning(lists, 'critical')).toBe(true);
  });

  it('matches today\'s Injured tile by default', () => {
    expect(isConcerning(defaults, 'Injured')).toBe(true);
    expect(isConcerning(defaults, 'Lethargic')).toBe(false);
    expect(isConcerning(defaults, 'Dead')).toBe(false);
    expect(isConcerning(defaults, null)).toBe(false);
  });
});
