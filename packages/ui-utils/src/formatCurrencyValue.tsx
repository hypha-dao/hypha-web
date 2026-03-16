const DEFAULT_MIN_FRACTION_DIGITS = 2;
const DEFAULT_MAX_FRACTION_DIGITS = 4;
const MAX_DECIMAL_PLACES = 20;

function getAdaptiveMaxFractionDigits(num: number): number {
  if (num === 0 || !Number.isFinite(num)) {
    return DEFAULT_MAX_FRACTION_DIGITS;
  }

  const absNum = Math.abs(num);

  if (absNum >= 0.01) {
    return DEFAULT_MAX_FRACTION_DIGITS;
  }

  const expStr = num.toExponential();
  const parts = expStr.split('e');
  const mantissa = parts[0] ?? '';
  const exp = parts[1] ?? '0';
  const exponent = parseInt(exp, 10);

  if (exponent >= 0) {
    return DEFAULT_MAX_FRACTION_DIGITS;
  }

  const mantissaDecimals = mantissa.includes('.')
    ? mantissa.split('.')[1]?.length ?? 0
    : 0;
  const decimalPlaces = Math.abs(exponent) + mantissaDecimals;

  return Math.min(
    Math.max(decimalPlaces, DEFAULT_MIN_FRACTION_DIGITS),
    MAX_DECIMAL_PLACES,
  );
}

export const formatCurrencyValue = (
  num: number | string,
  locale: 'en-US' | 'de-DE' = 'en-US',
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
