export const PRODUCTION_DEFAULT_TIMEFRAME = '7d' as const;

/**
 * Collapsed Ownership "earned from source" line. Reuses the 7d series
 * already prefetched for Production so owner rows do not wait on a cold
 * 12-month Azure aggregate (`monthly` → `period=12m`).
 */
export const OWNERSHIP_COLLAPSED_PERIOD = PRODUCTION_DEFAULT_TIMEFRAME;
