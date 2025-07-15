export const formatCurrencyValue = (
  num: number,
  locale: 'en-US' | 'de-DE' = 'en-US',
  options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  },
): string => {
  return new Intl.NumberFormat(locale, options).format(num);
};
