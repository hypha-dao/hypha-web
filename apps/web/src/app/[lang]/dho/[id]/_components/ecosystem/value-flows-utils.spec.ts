import { describe, expect, it } from 'vitest';
import type { TransferWithEntity } from '@hypha-platform/epics';
import { recipientId, transferTime } from './value-flows-utils';

function makeTransfer(
  overrides: Partial<TransferWithEntity> = {},
): TransferWithEntity {
  return {
    transactionHash: '0xabc',
    from: '0xFromAddress',
    to: '0xToAddress',
    value: 1,
    symbol: 'USDC',
    timestamp: 1_700_000_000_000,
    direction: 'outgoing',
    counterparty: 'to',
    ...overrides,
  };
}

describe('recipientId', () => {
  it('lowercases counterparty addresses in ids', () => {
    const transfer = makeTransfer({
      to: '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01',
      direction: 'outgoing',
    });

    expect(recipientId(transfer)).toBe(
      'addr-0xabcdef0123456789abcdef0123456789abcdef01',
    );
  });

  it('includes space title and lowercased address for space recipients', () => {
    const transfer = makeTransfer({
      to: '0xABCDEF0123456789ABCDEF0123456789ABCDEF01',
      space: { title: 'Treasury' },
    });

    expect(recipientId(transfer)).toBe(
      'space-Treasury-0xabcdef0123456789abcdef0123456789abcdef01',
    );
  });
});

describe('transferTime', () => {
  it('treats numeric timestamps below 1e12 as seconds', () => {
    expect(transferTime(makeTransfer({ timestamp: 1_700_000_000 }))).toBe(
      1_700_000_000_000,
    );
  });

  it('keeps millisecond numeric timestamps unchanged', () => {
    expect(transferTime(makeTransfer({ timestamp: 1_700_000_000_000 }))).toBe(
      1_700_000_000_000,
    );
  });

  it('parses ISO string timestamps', () => {
    expect(
      transferTime(makeTransfer({ timestamp: '2024-01-15T12:00:00.000Z' })),
    ).toBe(new Date('2024-01-15T12:00:00.000Z').getTime());
  });
});

describe('flow grouping key', () => {
  it('keeps symbols separate via |symbol suffix', () => {
    const base = makeTransfer({
      to: '0xRecipient',
      space: { title: 'Ops' },
    });

    const usdcKey = `${recipientId(base)}|USDC`;
    const ethKey = `${recipientId(base)}|ETH`;

    expect(usdcKey).toBe('space-Ops-0xrecipient|USDC');
    expect(ethKey).toBe('space-Ops-0xrecipient|ETH');
    expect(usdcKey).not.toBe(ethKey);
  });
});
