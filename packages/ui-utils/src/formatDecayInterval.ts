import { formatSeconds } from './formatSeconds';

const WEEK_SECONDS = 604800;
const MONTH_SECONDS = 2592000;
const YEAR_SECONDS = 31536000;

export const formatDecayInterval = (seconds: bigint | number): string => {
  const totalSeconds = Number(seconds);

  if (totalSeconds < 0 || totalSeconds === 0) {
    return '0 seconds';
  }

  const years = totalSeconds / YEAR_SECONDS;
  if (Math.abs(years - Math.round(years)) < 0.001) {
    const yearCount = Math.round(years);
    return `${yearCount} ${yearCount === 1 ? 'year' : 'years'}`;
  }

  const months = totalSeconds / MONTH_SECONDS;
  if (Math.abs(months - Math.round(months)) < 0.001) {
    const monthCount = Math.round(months);
    return `${monthCount} ${monthCount === 1 ? 'month' : 'months'}`;
  }

  const weeks = totalSeconds / WEEK_SECONDS;
  if (Math.abs(weeks - Math.round(weeks)) < 0.001) {
    const weekCount = Math.round(weeks);
    return `${weekCount} ${weekCount === 1 ? 'week' : 'weeks'}`;
  }

  return formatSeconds(seconds);
};
