import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { encodeContractQuantityPrice, WH_PER_KWH } from './build-readings';

describe('encodeContractQuantityPrice', () => {
  it('encodes exact whole-kWh amounts with kWh quantity', () => {
    const encoded = encodeContractQuantityPrice(3000, 11n, WH_PER_KWH);
    assert.deepEqual(encoded, { quantity: 3n, pricePerKwh: 11n });
    assert.equal(encoded!.quantity * encoded!.pricePerKwh, 33n);
  });

  it('encodes large fractional Wh via charge encoding (3200 Wh)', () => {
    const encoded = encodeContractQuantityPrice(3200, 11n, WH_PER_KWH);
    assert.deepEqual(encoded, { quantity: 1n, pricePerKwh: 35n });
  });

  it('encodes mid-size fractional Wh via charge encoding (500 Wh)', () => {
    const encoded = encodeContractQuantityPrice(500, 11n, WH_PER_KWH);
    assert.deepEqual(encoded, { quantity: 1n, pricePerKwh: 5n });
  });

  it('does not drop small Wh slices (20 Wh)', () => {
    const encoded = encodeContractQuantityPrice(20, 11n, WH_PER_KWH);
    assert.deepEqual(encoded, { quantity: 1n, pricePerKwh: 1n });
  });

  it('returns null for zero Wh', () => {
    assert.equal(encodeContractQuantityPrice(0, 11n, WH_PER_KWH), null);
  });
});
