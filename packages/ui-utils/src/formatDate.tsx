export const formatDate = (
  dateInput: string | number | Date,
  withTime?: boolean,
  timeZone?: string,
): string => {
  const date = new Date(dateInput);

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date input');
  }

  const targetTimeZone =
    timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: targetTimeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).formatToParts(date);

  const getPart = (type: 'year' | 'month' | 'day') =>
    dateParts.find((part) => part.type === type)?.value ?? '';

  let formattedDate = `${getPart('month')} ${getPart('day')}, ${getPart(
    'year',
  )}`;

  if (withTime) {
    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const getTimePart = (type: 'hour' | 'minute' | 'second') =>
      timeParts.find((part) => part.type === type)?.value ?? '00';

    formattedDate += ` ${getTimePart('hour')}:${getTimePart(
      'minute',
    )}:${getTimePart('second')}`;
  }

  return formattedDate;
};
