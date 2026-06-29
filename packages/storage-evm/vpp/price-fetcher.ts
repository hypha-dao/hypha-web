import type { GridPrices } from './run-interval';

const DEFAULT_API_BASE = 'https://api.hypha.energy';
const DEFAULT_IMPORT_CT = 30n;
const DEFAULT_EXPORT_CT = 8n;

export type SpotPriceRecord = {
  pricePerKwh: number;
  pricePerMwh?: number;
  slotStart?: string;
  countryPriceArea?: string;
};

export type FetchGridPricesOptions = {
  apiBaseUrl?: string;
  apiKey?: string;
  /** Spot market / country_price_area code (e.g. AT). */
  market?: string;
  /** ISO interval start used to pick the matching 15-min slot when available. */
  intervalStart?: string;
  importFallbackCt?: bigint;
  exportFallbackCt?: bigint;
  fetchFn?: typeof fetch;
};

function parseCt(value: string | undefined, fallback: bigint): bigint {
  if (!value?.trim()) return fallback;
  const n = BigInt(value.trim());
  return n >= 0n ? n : fallback;
}

function envImportFallback(): bigint {
  return parseCt(process.env.ENERGY_GRID_IMPORT_CT, DEFAULT_IMPORT_CT);
}

function envExportFallback(): bigint {
  return parseCt(process.env.ENERGY_GRID_EXPORT_CT, DEFAULT_EXPORT_CT);
}

/** Convert EUR/kWh (decimal) to contract ct/kWh bigint. */
export function eurKwhToCtPerKwh(pricePerKwh: number): bigint {
  if (!Number.isFinite(pricePerKwh) || pricePerKwh < 0) {
    return DEFAULT_IMPORT_CT;
  }
  return BigInt(Math.round(pricePerKwh * 100));
}

function readNumberField(
  record: Record<string, unknown>,
  snake: string,
  camel: string,
): number | undefined {
  const snakeVal = record[snake];
  if (typeof snakeVal === 'number') return snakeVal;
  const camelVal = record[camel];
  if (typeof camelVal === 'number') return camelVal;
  return undefined;
}

function readStringField(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function pickLatestPrice(body: unknown): SpotPriceRecord | null {
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;
  const pricePerKwh = readNumberField(record, 'price_per_kwh', 'pricePerKwh');

  if (pricePerKwh !== undefined) {
    return {
      pricePerKwh,
      pricePerMwh: readNumberField(record, 'price_per_mwh', 'pricePerMwh'),
      slotStart: readStringField(record, 'slot_start_utc', 'time'),
      countryPriceArea: readStringField(
        record,
        'country_price_area',
        'marketCode',
        'market',
      ),
    };
  }

  if (Array.isArray(body) && body.length > 0) {
    const first = body[0];
    if (first && typeof first === 'object') {
      return pickLatestPrice(first);
    }
  }

  return null;
}

async function fetchSpotFromApi(
  options: FetchGridPricesOptions,
): Promise<SpotPriceRecord | null> {
  const base = (
    options.apiBaseUrl ??
    process.env.ENERGY_API_BASE_URL ??
    DEFAULT_API_BASE
  ).replace(/\/$/, '');
  const apiKey =
    options.apiKey ?? process.env.ENERGY_API_KEY ?? process.env.X_API_KEY;
  const market =
    options.market ??
    process.env.ENERGY_PRICE_MARKET ??
    process.env.ENERGY_COUNTRY_PRICE_AREA ??
    'AT';
  const fetchImpl = options.fetchFn ?? fetch;

  const paths = [
    '/v1/prices/latest',
    `/v1/prices/latest?market=${encodeURIComponent(market)}`,
    `/v1/prices/latest?country_price_area=${encodeURIComponent(market)}`,
  ];

  if (options.intervalStart) {
    const from = options.intervalStart.slice(0, 10);
    paths.push(
      `/v1/prices?market=${encodeURIComponent(
        market,
      )}&from=${from}&to=${from}&limit=96`,
    );
  }

  for (const path of paths) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey) headers['X-Api-Key'] = apiKey;

      const res = await fetchImpl(`${base}${path}`, { headers });
      if (!res.ok) continue;

      const body = (await res.json()) as unknown;
      const picked = pickLatestPrice(body);
      if (picked) return picked;
    } catch {
      // try next path
    }
  }

  return null;
}

/**
 * Resolve grid import/export prices for one settlement interval.
 * Primary: Hypha Energy API spot price. Fallback: env overrides, then demo defaults.
 */
export async function fetchGridPrices(
  options: FetchGridPricesOptions = {},
): Promise<
  GridPrices & { source: 'api' | 'env' | 'default'; spot?: SpotPriceRecord }
> {
  const importFallback = options.importFallbackCt ?? envImportFallback();
  const exportFallback = options.exportFallbackCt ?? envExportFallback();

  const spot = await fetchSpotFromApi(options);
  if (spot) {
    const importPricePerKwh = eurKwhToCtPerKwh(spot.pricePerKwh);
    return {
      importPricePerKwh,
      exportPricePerKwh: exportFallback,
      source: 'api',
      spot,
    };
  }

  const envImport = process.env.ENERGY_GRID_IMPORT_CT?.trim();
  const envExport = process.env.ENERGY_GRID_EXPORT_CT?.trim();
  if (envImport || envExport) {
    return {
      importPricePerKwh: envImport
        ? parseCt(envImport, importFallback)
        : importFallback,
      exportPricePerKwh: envExport
        ? parseCt(envExport, exportFallback)
        : exportFallback,
      source: 'env',
    };
  }

  return {
    importPricePerKwh: importFallback,
    exportPricePerKwh: exportFallback,
    source: 'default',
  };
}
