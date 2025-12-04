export const formatSeconds = (seconds: bigint | number): string => {
  const totalSeconds = Number(seconds);

  if (totalSeconds < 0) {
    return '0 seconds';
  }

  if (totalSeconds === 0) {
    return '0 seconds';
  }

  const SECOND = 1;
  const MINUTE = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const WEEK = 604800;
  const MONTH = 2592000;
  const YEAR = 31536000;

  const years = Math.floor(totalSeconds / YEAR);
  const months = Math.floor((totalSeconds % YEAR) / MONTH);
  const weeks = Math.floor((totalSeconds % MONTH) / WEEK);
  const days = Math.floor((totalSeconds % WEEK) / DAY);
  const hours = Math.floor((totalSeconds % DAY) / HOUR);
  const minutes = Math.floor((totalSeconds % HOUR) / MINUTE);
  const secs = Math.floor(totalSeconds % MINUTE);

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }
  if (weeks > 0) {
    parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
  }
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  if (secs > 0 && parts.length === 0) {
    parts.push(`${secs} ${secs === 1 ? 'second' : 'seconds'}`);
  }

  if (parts.length > 2) {
    return parts.slice(0, 2).join(' ');
  }

  return parts.join(' ') || '0 seconds';
};
