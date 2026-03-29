/**
 * Read grouping (thousands) and decimal separators for a locale from Intl.
 */
export function getLocaleNumberSeparators(locale: string): {
  group: string;
  decimal: string;
} {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.8);
  let group = ',';
  let decimal = '.';
  for (const p of parts) {
    if (p.type === 'group') group = p.value;
    if (p.type === 'decimal') decimal = p.value;
  }
  return { group, decimal };
}

/**
 * Parse user input that uses the locale's decimal and grouping separators
 * into a finite number. Returns undefined for empty input or unparseable values.
 */
export function parseLocaleDecimal(
  raw: string,
  locale: string,
): number | undefined {
  const trimmed = raw.trim().replace(/\s/g, '');
  if (trimmed === '') return undefined;

  const { group, decimal } = getLocaleNumberSeparators(locale);
  let s = trimmed.split(group).join('');
  if (decimal !== '.') {
    const decParts = s.split(decimal);
    if (decParts.length > 2) return undefined;
    s = decParts.join('.');
  }

  if (!/^\d*\.?\d*$/.test(s) || s === '.' || !/\d/.test(s)) {
    return undefined;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export type FormatLocaleDecimalOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
};

/**
 * Format a number for display in a decimal text field using the given locale.
 */
export function formatLocaleDecimal(
  value: number | undefined | null,
  locale: string,
  options: FormatLocaleDecimalOptions = {},
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '';
  }
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 10,
    useGrouping = true,
  } = options;
  return new Intl.NumberFormat(locale, {
    useGrouping,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}
