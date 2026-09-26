import { daysBetween } from './utils';

/**
 * Where a nest is in its season, for the lists and the dashboard.
 *
 * Loggerhead nests on Kefalonia hatch after roughly 50-65 days. Past
 * DUE_TO_HATCH_DAYS a nest should be watched for emergence; past OVERDUE_DAYS
 * it has gone well beyond a normal incubation and someone needs to excavate it
 * and record an inventory. Neither changes the nest's status - they only say
 * when it wants attention.
 */
export const DUE_TO_HATCH_DAYS = 45;
export const OVERDUE_DAYS = 70;

export interface NestLifecycleFields {
  status?: string | null;
  is_archived?: boolean | string | number | null;
  isArchive?: boolean | string | number | null;
  date_laid?: string | null;
  date_found?: string | null;
}

const truthy = (v: unknown) => v === true || v === 'yes' || v === 1 || v === 'true';

export const isArchivedNest = (n: NestLifecycleFields): boolean =>
  truthy(n.is_archived) || truthy(n.isArchive);

export const isHatchedNest = (n: NestLifecycleFields): boolean =>
  String(n.status || '').toLowerCase() === 'hatched';

/**
 * A nest still being watched: not archived and not yet hatched. A hatched nest
 * has finished its season even if nobody has archived it, and counting it as
 * "active" inflated the dashboard with nests that had nothing left to do.
 */
export const isOpenNest = (n: NestLifecycleFields): boolean =>
  !isArchivedNest(n) && !isHatchedNest(n);

export const incubationDays = (n: NestLifecycleFields, now: Date = new Date()): number | null => {
  const from = n.date_laid || n.date_found;
  if (!from) return null;
  const days = daysBetween(from, now);
  return days === null ? null : Math.max(0, days);
};

export type NestAttention = 'overdue' | 'due' | null;

/** Whether an open nest is due to hatch, or overdue for excavation. */
export const nestAttention = (n: NestLifecycleFields, now: Date = new Date()): NestAttention => {
  if (!isOpenNest(n)) return null;
  const days = incubationDays(n, now);
  if (days === null) return null;
  if (days >= OVERDUE_DAYS) return 'overdue';
  if (days >= DUE_TO_HATCH_DAYS) return 'due';
  return null;
};
