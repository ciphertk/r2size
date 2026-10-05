/** Profile staleness in calendar days in the device's local time (D12), not 24-hour periods. */

const MS_PER_DAY = 86_400_000;

/** A local calendar date as a day count, independent of the time of day. */
const localDay = (date: Date): number =>
  Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);

/** 23:59 yesterday → 00:01 today is 1 day; early and late on the same day is 0. */
export const daysSince = (isoTimestamp: string, now: Date): number =>
  localDay(now) - localDay(new Date(isoTimestamp));

export const isStale = (days: number, staleDays: number): boolean => days >= staleDays;
