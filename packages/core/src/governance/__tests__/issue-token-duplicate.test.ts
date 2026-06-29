import { describe, expect, it } from 'vitest';
import type { DbToken } from '../../common/types';
import {
  findBlockingDuplicateIssueToken,
  isBlockingDuplicateIssueToken,
} from '../issue-token-duplicate';

const baseToken = (overrides: Partial<DbToken> = {}): DbToken => ({
  name: 'Local Impact Token',
  symbol: 'LIT',
  maxSupply: 0,
  type: 'impact',
  transferable: true,
  isVotingToken: false,
  spaceId: 42,
  ...overrides,
});

const options = {
  spaceId: 42,
  name: 'Local Impact Token',
  symbol: 'LIT',
  rejectedProposalIds: new Set<number>([1001]),
  withdrawnProposalIds: new Set<number>([1002]),
};

describe('isBlockingDuplicateIssueToken', () => {
  it('blocks deployed tokens with matching name and symbol in the same space', () => {
    expect(
      isBlockingDuplicateIssueToken(
        baseToken({ address: '0xabc', agreementWeb3Id: 999 }),
        options,
      ),
    ).toBe(true);
  });

  it('does not block undeployed tokens from rejected proposals', () => {
    expect(
      isBlockingDuplicateIssueToken(
        baseToken({ agreementWeb3Id: 1001 }),
        options,
      ),
    ).toBe(false);
  });

  it('does not block undeployed tokens from withdrawn proposals', () => {
    expect(
      isBlockingDuplicateIssueToken(
        baseToken({ agreementWeb3Id: 1002 }),
        options,
      ),
    ).toBe(false);
  });

  it('blocks undeployed tokens tied to active proposals', () => {
    expect(
      isBlockingDuplicateIssueToken(
        baseToken({ agreementWeb3Id: 2000 }),
        options,
      ),
    ).toBe(true);
  });

  it('ignores tokens in other spaces or with different name/symbol', () => {
    expect(
      isBlockingDuplicateIssueToken(baseToken({ spaceId: 99 }), options),
    ).toBe(false);
    expect(
      isBlockingDuplicateIssueToken(
        baseToken({ name: 'Other Token' }),
        options,
      ),
    ).toBe(false);
  });
});

describe('findBlockingDuplicateIssueToken', () => {
  it('returns the first blocking token when one exists', () => {
    const tokens = [
      baseToken({ agreementWeb3Id: 1001 }),
      baseToken({ address: '0xabc' }),
    ];

    expect(findBlockingDuplicateIssueToken(tokens, options)).toEqual(tokens[1]);
  });

  it('returns undefined when only rejected drafts match', () => {
    const tokens = [baseToken({ agreementWeb3Id: 1001 })];

    expect(findBlockingDuplicateIssueToken(tokens, options)).toBeUndefined();
  });
});
