export type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

export interface RelativeDateOptions {
  language?: string;
  suffix?: string;
  prefix?: string;
}

export interface TimeUnits {
  second: string;
  minute: string;
  hour: string;
  day: string;
  month: string;
  year: string;
  seconds: string;
  minutes: string;
  hours: string;
  days: string;
  months: string;
  years: string;
}

// Default English translations
const defaultTranslations: TimeUnits = {
  second: 'second',
  minute: 'minute',
  hour: 'hour',
  day: 'day',
  month: 'month',
  year: 'year',
  seconds: 'seconds',
  minutes: 'minutes',
  hours: 'hours',
  days: 'days',
  months: 'months',
  years: 'years',
};

// Multilingual support - can be extended with more languages
const translations: Record<string, TimeUnits> = {
  en: defaultTranslations,
  // Add more languages here in the future
  de: {
    second: 'Sekunde',
    minute: 'Minute',
    hour: 'Stunde',
    day: 'Tag',
    month: 'Monat',
    year: 'Jahr',
    seconds: 'Sekunden',
    minutes: 'Minuten',
    hours: 'Stunden',
    days: 'Tage',
    months: 'Monate',
    years: 'Jahre',
  },
};

/**
 * Format a date as "% minutes/hours/days/months/years ago"
 * @param dateInput - The date to format
 * @param options - Formatting options
 * @returns Formatted relative date string
 */
export const formatRelativeDate = (
  dateInput: string | number | Date,
  options: RelativeDateOptions = {},
): string => {
  const { language = 'en', prefix = '', suffix = 'ago' } = options;

  const date = new Date(dateInput);

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date input');
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const translationsForLanguage = translations[language] || defaultTranslations;

  let value: number;
  let unit: string;

  if (diffSeconds < 60) {
    value = diffSeconds;
    unit =
      value === 1
        ? translationsForLanguage.second
        : translationsForLanguage.seconds;
  } else if (diffMinutes < 60) {
    value = diffMinutes;
    unit =
      value === 1
        ? translationsForLanguage.minute
        : translationsForLanguage.minutes;
  } else if (diffHours < 24) {
    value = diffHours;
    unit =
      value === 1
        ? translationsForLanguage.hour
        : translationsForLanguage.hours;
  } else if (diffDays < 30) {
    value = diffDays;
    unit =
      value === 1 ? translationsForLanguage.day : translationsForLanguage.days;
  } else if (diffMonths < 12) {
    value = diffMonths;
    unit =
      value === 1
        ? translationsForLanguage.month
        : translationsForLanguage.months;
  } else {
    value = diffYears;
    unit =
      value === 1
        ? translationsForLanguage.year
        : translationsForLanguage.years;
  }

  const prefixStr = prefix ? `${prefix} ` : '';
  const suffixStr = suffix ? ` ${suffix}` : '';

  return `${prefixStr}${value} ${unit}${suffixStr}`;
};

/**
 * Format a date as "% minutes/hours/days/months/years ago" with short units
 * @param dateInput - The date to format
 * @param options - Formatting options
 * @returns Formatted relative date string with short units
 */
export const formatRelativeDateShort = (
  dateInput: string | number | Date,
  options: RelativeDateOptions = {},
): string => {
  const { language = 'en', prefix = '', suffix = 'ago' } = options;

  const date = new Date(dateInput);

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date input');
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const translationsForLanguage = translations[language] || defaultTranslations;

  let value: number;
  let unit: string;

  if (diffSeconds < 60) {
    value = diffSeconds;
    unit = 's'; // seconds
  } else if (diffMinutes < 60) {
    value = diffMinutes;
    unit = 'm'; // minutes
  } else if (diffHours < 24) {
    value = diffHours;
    unit = 'h'; // hours
  } else if (diffDays < 30) {
    value = diffDays;
    unit = 'd'; // days
  } else if (diffMonths < 12) {
    value = diffMonths;
    unit = 'mo'; // months
  } else {
    value = diffYears;
    unit = 'y'; // years
  }

  const prefixStr = prefix ? `${prefix} ` : '';
  const suffixStr = suffix ? ` ${suffix}` : '';

  return `${prefixStr}${value}${unit}${suffixStr}`;
};

export default formatRelativeDate;
