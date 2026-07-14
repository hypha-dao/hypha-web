import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eurKwhToCtPerKwh, fetchGridPrices } from './price-fetcher';

describe('price-fetcher', () => {
  it('eurKwhToCtPerKwh converts decimal EUR to cent bigint', () => {
    assert.equal(eurKwhToCtPerKwh(0.12), 12n);
    assert.equal(eurKwhToCtPerKwh(0.305), 31n);
  });

  it('fetchGridPrices uses API spot when available (snake_case)', async () => {
    const prices = await fetchGridPrices({
      apiKey: 'test',
      market: 'AT',
      fetchFn: async () =>
        ({
          ok: true,
          json: async () => ({ price_per_kwh: 0.089, price_per_mwh: 89 }),
        } as Response),
    });

    assert.equal(prices.source, 'api');
    assert.equal(prices.importPricePerKwh, 9n);
    assert.equal(prices.exportPricePerKwh, 8n);
  });

  it('fetchGridPrices uses API spot when available (camelCase)', async () => {
    const prices = await fetchGridPrices({
      apiKey: 'test',
      fetchFn: async () =>
        ({
          ok: true,
          json: async () => ({
            time: '2026-06-29T21:45:00+00:00',
            marketCode: 'NO3',
            pricePerKwh: 0.08114,
            pricePerMwh: 81.14,
            currency: 'EUR',
          }),
        } as Response),
    });

    assert.equal(prices.source, 'api');
    assert.equal(prices.importPricePerKwh, 8n);
    assert.equal(prices.spot?.countryPriceArea, 'NO3');
  });

  it('fetchGridPrices falls back to defaults when API returns 404', async () => {
    const prevImport = process.env.ENERGY_GRID_IMPORT_CT;
    const prevExport = process.env.ENERGY_GRID_EXPORT_CT;
    delete process.env.ENERGY_GRID_IMPORT_CT;
    delete process.env.ENERGY_GRID_EXPORT_CT;

    try {
      const prices = await fetchGridPrices({
        fetchFn: async () => ({ ok: false, status: 404 } as Response),
      });
      assert.equal(prices.source, 'default');
      assert.equal(prices.importPricePerKwh, 30n);
      assert.equal(prices.exportPricePerKwh, 8n);
    } finally {
      if (prevImport !== undefined) {
        process.env.ENERGY_GRID_IMPORT_CT = prevImport;
      }
      if (prevExport !== undefined) {
        process.env.ENERGY_GRID_EXPORT_CT = prevExport;
      }
    }
  });

  it('fetchGridPrices respects env overrides when API fails', async () => {
    const prevImport = process.env.ENERGY_GRID_IMPORT_CT;
    const prevExport = process.env.ENERGY_GRID_EXPORT_CT;
    process.env.ENERGY_GRID_IMPORT_CT = '42';
    process.env.ENERGY_GRID_EXPORT_CT = '11';

    try {
      const prices = await fetchGridPrices({
        fetchFn: async () => ({ ok: false, status: 404 } as Response),
      });
      assert.equal(prices.source, 'env');
      assert.equal(prices.importPricePerKwh, 42n);
      assert.equal(prices.exportPricePerKwh, 11n);
    } finally {
      if (prevImport !== undefined) {
        process.env.ENERGY_GRID_IMPORT_CT = prevImport;
      } else {
        delete process.env.ENERGY_GRID_IMPORT_CT;
      }
      if (prevExport !== undefined) {
        process.env.ENERGY_GRID_EXPORT_CT = prevExport;
      } else {
        delete process.env.ENERGY_GRID_EXPORT_CT;
      }
    }
  });
});
