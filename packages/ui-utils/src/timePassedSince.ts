import { intervalToDuration } from 'date-fns';

export function timePassedSince(date?: Date): string {
  if (!date) return '0s';
  const now = new Date();
  const duration = intervalToDuration({ start: date, end: now });

  if (duration.years && duration.years > 0) return `${duration.years}y`;
  if (duration.months && duration.months > 0) return `${duration.months}mo`;
  if (duration.days && duration.days > 0) return `${duration.days}d`;
  if (duration.hours && duration.hours > 0) return `${duration.hours}h`;
  if (duration.minutes && duration.minutes > 0) return `${duration.minutes}m`;
  return `${duration.seconds || 0}s`;
}
