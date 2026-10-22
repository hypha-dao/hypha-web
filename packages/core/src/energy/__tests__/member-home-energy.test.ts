import { describe, expect, it } from 'vitest';

import {
  bankQrPayload,
  buildMemberEnergyFigures,
  formatStablecoinMicro,
  oweEurosFromKwh,
  pickActivatedBankAccount,
  walletQrPayload,
} from '../member-home-energy';

const meters = [
  { meterId: 1, valuesKwh: [10, 4] },
  { meterId: 2, valuesKwh: [3, 1] },
  { meterId: 9, valuesKwh: [100, 80] },
];

describe('buildMemberEnergyFigures', () => {
  it('uses this month and last month of the member meters', () => {
    const figures = buildMemberEnergyFigures({
      telemetryEnabled: true,
      consumptionKwh: [200, 90],
      consumptionByMeter: meters,
      productionBySource: [{ valuesKwh: [40, 20] }],
      deviceIds: [1, 2],
      ownerships: [{ ownershipBps: '10000' }],
      sourceCount: 1,
      pricePerKwhCt: 10n,
      debtMicro: '18400000',
    });

    expect(figures.youUsedKwh).toBe(5);
    expect(figures.youMadeKwh).toBe(20);
    expect(figures.communityUsedKwh).toBe(90);
    expect(figures.communityMadeKwh).toBe(20);
    expect(figures.oweThisMonth).toBe('0.50');
    expect(figures.oweLastMonth).toBe('1.30');
    expect(figures.settleAmount).toBe('18.40');
  });

  it('leaves usage empty when telemetry is off and still reports the debt', () => {
    const figures = buildMemberEnergyFigures({
      telemetryEnabled: false,
      consumptionKwh: [],
      consumptionByMeter: [],
      productionBySource: [],
      deviceIds: null,
      ownerships: [],
      sourceCount: 0,
      pricePerKwhCt: null,
      debtMicro: '0',
    });

    expect(figures.youUsedKwh).toBeNull();
    expect(figures.oweThisMonth).toBeNull();
    expect(figures.settleAmount).toBe('0.00');
  });
});

describe('money and payment codes', () => {
  it('converts stablecoin micro units', () => {
    expect(formatStablecoinMicro('1000000')).toBe('1.00');
    expect(formatStablecoinMicro(null)).toBeNull();
  });

  it('prices usage in euro cents per kWh', () => {
    expect(oweEurosFromKwh(12.5, 20n)).toBe('2.50');
    expect(oweEurosFromKwh(null, 20n)).toBeNull();
  });

  it('builds a wallet address and a SEPA code for an activated account', () => {
    expect(walletQrPayload('0x' + 'ab'.repeat(20))).toMatch(/^0x/);
    expect(walletQrPayload('nope')).toBeNull();

    const bank = pickActivatedBankAccount([
      {
        status: 'deactivated',
        paymentRail: 'sepa',
        currency: 'eur',
        depositInstructions: { iban: 'DE89370400440532013000' },
      },
      {
        status: 'activated',
        paymentRail: 'sepa',
        currency: 'eur',
        depositInstructions: {
          iban: 'DE89 3704 0044 0532 0130 00',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Oak Energy',
        },
      },
    ]);

    expect(bank?.iban).toContain('DE89');
    expect(bankQrPayload(bank, '18.40', 'Oak Energy')).toBe(
      [
        'BCD',
        '002',
        '1',
        'SCT',
        'COBADEFFXXX',
        'Oak Energy',
        'DE89370400440532013000',
        'EUR18.40',
        '',
        '',
      ].join('\n'),
    );
  });
});
