export type DurationParts = {
  unit: 'hours' | 'days';
  count: number;
};

/**
 * Split a duration in seconds into a display unit and count, so callers can
 * localize the unit label (e.g. via next-intl plural messages).
 */
export const getDurationParts = (seconds: number): DurationParts => {
  const hours = seconds / 3600;

  if (hours < 24) {
    return { unit: 'hours', count: hours };
  }
  return { unit: 'days', count: hours / 24 };
};

export const formatDuration = (seconds: number): string => {
  const { unit, count } = getDurationParts(seconds);

  if (unit === 'hours') {
    return `${count} Hour${count !== 1 ? 's' : ''}`;
  }
  return `${count} Day${count !== 1 ? 's' : ''}`;
};
