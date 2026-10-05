const UNITS: [number, string][] = [
  [31536000, 'year'],
  [2592000, 'month'],
  [86400, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
];

/**
 * "Just now", "1 minute ago", "3 hours ago" - singular where the count is
 * one. A future date (a record dated ahead of today) used to be clamped to
 * 0 and read as "Just now", which looks like it was entered seconds ago
 * when it's really dated weeks out - says "in 3 days" instead.
 */
export const timeAgo = (date: Date, now: Date = new Date()): string => {
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  const seconds = Math.abs(diff);
  for (const [size, name] of UNITS) {
    const count = Math.floor(seconds / size);
    if (count >= 1) {
      const unit = `${count} ${name}${count === 1 ? '' : 's'}`;
      return diff < 0 ? `in ${unit}` : `${unit} ago`;
    }
  }
  return 'Just now';
};
