import { formatLocalDateTime } from './local-date-time';

export const formatDate = (
  dateInput: string | number | Date,
  withTime?: boolean,
  locale?: string,
): string => {
  return formatLocalDateTime(dateInput, { withTime, locale });
};
