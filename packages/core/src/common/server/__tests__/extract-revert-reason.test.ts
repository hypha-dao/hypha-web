import { describe, expect, it } from 'vitest';
import { encodeErrorResult } from 'viem';
import {
  classifyTransferRevertReason,
  ERROR_STRING_SELECTOR,
  extractRevertReason,
  inspectChainRevert,
} from '../extract-revert-reason';

function errorStringData(reason: string) {
  return encodeErrorResult({
    abi: [
      {
        type: 'error',
        name: 'Error',
        inputs: [{ type: 'string' }],
      },
    ],
    args: [reason],
  });
}

describe('classifyTransferRevertReason', () => {
  it('maps RegularSpaceToken !credit to credit_limit', () => {
    expect(classifyTransferRevertReason('!credit')).toBe('credit_limit');
  });

  it('maps Insufficient credit to credit_limit', () => {
    expect(classifyTransferRevertReason('Insufficient credit')).toBe(
      'credit_limit',
    );
  });

  it('does not treat transfer whitelist as credit limit', () => {
    expect(
      classifyTransferRevertReason('Sender not whitelisted to transfer'),
    ).toBe('sender_not_whitelisted');
    expect(
      classifyTransferRevertReason('Recipient not whitelisted to receive'),
    ).toBe('recipient_not_whitelisted');
  });
});

describe('inspectChainRevert', () => {
  it('decodes Error(string) selector and reason from viem-shaped data', () => {
    const data = errorStringData('!credit');
    const inspected = inspectChainRevert({
      message: 'The contract function "transfer" reverted.',
      shortMessage: 'The contract function "transfer" reverted.',
      data,
    });

    expect(inspected.selector).toBe(ERROR_STRING_SELECTOR);
    expect(inspected.reason).toBe('!credit');
    expect(inspected.kind).toBe('credit_limit');
  });

  it('extracts a revert string from Execution reverted with reason', () => {
    const inspected = inspectChainRevert(
      new Error(
        'Execution reverted with reason: Sender not whitelisted to transfer.',
      ),
    );
    expect(inspected.reason).toBe('Sender not whitelisted to transfer');
    expect(inspected.kind).toBe('sender_not_whitelisted');
  });
});

describe('extractRevertReason', () => {
  it('returns the decoded Error(string) reason', () => {
    expect(extractRevertReason({ data: errorStringData('!credit') })).toBe(
      '!credit',
    );
  });
});
