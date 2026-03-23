const DEFAULT_MIN_FRACTION_DIGITS = 2;
const DEFAULT_MAX_FRACTION_DIGITS = 4;
const SIGNIFICANT_DIGITS = 2;

function getAdaptiveMaxFractionDigits(num: number): number {
  if (num === 0 || !Number.isFinite(num)) {
    return DEFAULT_MAX_FRACTION_DIGITS;
  }

  const absNum = Math.abs(num);

  if (absNum >= 0.01) {
    return DEFAULT_MAX_FRACTION_DIGITS;
  }

  // Round to 2 significant digits: decimalPlaces = 2 - ceil(log10(|num|))
  const exponent = Math.ceil(Math.log10(absNum));
  const decimalPlaces = Math.max(0, SIGNIFICANT_DIGITS - exponent);

  return Math.max(decimalPlaces, DEFAULT_MIN_FRACTION_DIGITS);
}

export const formatCurrencyValue = (
  num: number | string,
  locale: string = 'en-US',
  options: Intl.NumberFormatOptions = {
    minimumFractionDigits: DEFAULT_MIN_FRACTION_DIGITS,
    maximumFractionDigits: DEFAULT_MAX_FRACTION_DIGITS,
  },
): string => {
  const numValue = typeof num === 'string' ? Number(num) : num;
  if (!Number.isFinite(numValue)) {
    return new Intl.NumberFormat(locale, {
      ...options,
      minimumFractionDigits:
        options.minimumFractionDigits ?? DEFAULT_MIN_FRACTION_DIGITS,
      maximumFractionDigits:
        options.maximumFractionDigits ?? DEFAULT_MAX_FRACTION_DIGITS,
    }).format(0);
  }
  const baseMax = options.maximumFractionDigits ?? DEFAULT_MAX_FRACTION_DIGITS;
  const adaptiveMax = getAdaptiveMaxFractionDigits(numValue);
  const minFractionDigits =
    options.minimumFractionDigits ?? DEFAULT_MIN_FRACTION_DIGITS;

  const mergedOptions: Intl.NumberFormatOptions = {
    ...options,
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: Math.max(baseMax, adaptiveMax, minFractionDigits),
  };

  return new Intl.NumberFormat(locale, mergedOptions).format(numValue);
};
