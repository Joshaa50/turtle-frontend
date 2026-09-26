import type { ListSettings } from '../types';

/**
 * Dropdown options from the coordinator's lists.
 *
 * Only options in use are offered, but the value a record already holds is
 * always included - a turtle saved with a species that was later retired must
 * still show it, and re-saving the form must not silently swap it for the
 * first entry in the list.
 */
export interface Option {
  value: string;
  label: string;
}

export const speciesOptions = (lists: ListSettings, current?: string | null): Option[] => {
  const options = lists.species.filter((s) => s.active).map((s) => ({ value: s.value, label: s.label }));
  if (current && !options.some((o) => o.value.toLowerCase() === current.toLowerCase())) {
    const known = lists.species.find((s) => s.value.toLowerCase() === current.toLowerCase());
    options.push({ value: current, label: known ? `${known.label} (retired)` : current });
  }
  return options;
};

export const healthOptions = (lists: ListSettings, current?: string | null): Option[] => {
  const options = lists.health_conditions.filter((h) => h.active).map((h) => ({ value: h.value, label: h.value }));
  if (current && !options.some((o) => o.value.toLowerCase() === current.toLowerCase())) {
    const known = lists.health_conditions.some((h) => h.value.toLowerCase() === current.toLowerCase());
    options.push({ value: current, label: known ? `${current} (retired)` : current });
  }
  return options;
};

/**
 * Conditions that count as a concern, for the dashboard's tile. "Sick" and
 * "Critical" are always included: records made before the lists existed use them.
 */
export const isConcerning = (lists: ListSettings, condition?: string | null): boolean => {
  if (!condition) return false;
  const c = condition.toLowerCase();
  if (c === 'sick' || c === 'critical') return true;
  return lists.health_conditions.some((h) => h.concerning && h.value.toLowerCase() === c);
};
