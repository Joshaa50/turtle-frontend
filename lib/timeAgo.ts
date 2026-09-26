/** "Just now", "1 minute ago", "3 hours ago" - singular where the count is one. */
export const timeAgo = (date: Date, now: Date = new Date()): string => {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  const units: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, name] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) return `${count} ${name}${count === 1 ? '' : 's'} ago`;
  }
  return 'Just now';
};
