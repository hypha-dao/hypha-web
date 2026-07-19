import { describe, expect, it } from 'vitest';
import {
  buildProposeContributionMetadata,
  deserializePaymentSchedule,
  isImmediatePaymentSchedule,
  parseDocumentMetadata,
  serializeDocumentMetadata,
  serializePaymentSchedule,
} from '../contribution-metadata';

describe('contribution-metadata', () => {
  it('serializes and deserializes future payment schedule', () => {
    const futureDate = new Date('2026-12-01T12:00:00.000Z');
    const serialized = serializePaymentSchedule({
      option: 'Future Payment',
      futureDate,
    });

    expect(serialized).toEqual({
      option: 'Future Payment',
      futureDate: futureDate.toISOString(),
    });

    const restored = deserializePaymentSchedule(serialized);
    expect(restored.option).toBe('Future Payment');
    expect(restored.futureDate?.toISOString()).toBe(futureDate.toISOString());
  });

  it('serializes and deserializes milestone schedule', () => {
    const from = new Date('2026-08-01T00:00:00.000Z');
    const serialized = serializePaymentSchedule({
      option: 'Milestones',
      milestones: [{ percentage: 50, dateRange: { from, to: undefined } }],
    });

    const restored = deserializePaymentSchedule(serialized);
    expect(restored.option).toBe('Milestones');
    expect(restored.milestones?.[0]?.percentage).toBe(50);
    expect(restored.milestones?.[0]?.dateRange?.from?.toISOString()).toBe(
      from.toISOString(),
    );
  });

  it('builds and parses document metadata', () => {
    const metadata = buildProposeContributionMetadata({
      recipient: '0x1234567890123456789012345678901234567890',
      payouts: [
        { amount: '100', token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
      ],
      paymentSchedule: { option: 'Immediately' },
    });

    const serialized = serializeDocumentMetadata(metadata);
    const parsed = parseDocumentMetadata(serialized);

    expect(parsed?.proposeContribution?.recipient).toBe(
      metadata.proposeContribution?.recipient,
    );
    expect(parsed?.proposeContribution?.payouts).toEqual(
      metadata.proposeContribution?.payouts,
    );
    expect(parsed?.proposeContribution?.paymentSchedule.option).toBe(
      'Immediately',
    );
  });

  it('detects immediate payment schedule', () => {
    expect(isImmediatePaymentSchedule(undefined)).toBe(true);
    expect(isImmediatePaymentSchedule({ option: 'Immediately' })).toBe(true);
    expect(
      isImmediatePaymentSchedule({
        option: 'Future Payment',
        futureDate: new Date(),
      }),
    ).toBe(false);
  });
});
