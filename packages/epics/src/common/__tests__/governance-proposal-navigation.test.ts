/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  isGovernancePrepareNavigationStale,
  markGovernancePrepareNavigationKeysStale,
  mergeGovernanceResubmitPayloads,
} from '../governance-proposal-navigation';

describe('mergeGovernanceResubmitPayloads', () => {
  it('merges quorum and unity without dropping earlier values', () => {
    const merged = mergeGovernanceResubmitPayloads(
      {
        votingMethod: '1m1v',
        quorumAndUnity: { quorum: 30, unity: 80 },
        title: 'Existing title',
      },
      {
        quorumAndUnity: { quorum: 25 },
        description: 'New description',
      },
    );

    expect(merged.votingMethod).toBe('1m1v');
    expect(merged.quorumAndUnity).toEqual({ quorum: 25, unity: 80 });
    expect(merged.title).toBe('Existing title');
    expect(merged.description).toBe('New description');
  });

  it('preserves voting duration when a later update omits it', () => {
    const merged = mergeGovernanceResubmitPayloads(
      {
        votingDuration: 259200,
        autoExecution: false,
      },
      {
        quorumAndUnity: { unity: 75 },
      },
    );

    expect(merged.votingDuration).toBe(259200);
    expect(merged.autoExecution).toBe(false);
    expect(merged.quorumAndUnity).toEqual({ unity: 75 });
  });

  it('preserves real title when a partial update sends placeholder draft title', () => {
    const merged = mergeGovernanceResubmitPayloads(
      { title: 'Change Voting Method to 1m1v' },
      { title: 'Governance proposal', votingMethod: '1m1v' },
    );

    expect(merged.title).toBe('Change Voting Method to 1m1v');
    expect(merged.votingMethod).toBe('1m1v');
  });
});

describe('governance prepare navigation stale keys', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('marks and detects stale prepare navigation keys', () => {
    markGovernancePrepareNavigationKeysStale(['msg-1:part:0:/en/dho/x:create']);
    expect(
      isGovernancePrepareNavigationStale('msg-1:part:0:/en/dho/x:create'),
    ).toBe(true);
    expect(
      isGovernancePrepareNavigationStale('msg-2:part:0:/en/dho/x:create'),
    ).toBe(false);
  });
});
