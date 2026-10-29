import { describe, expect, it } from 'vitest';
import {
  countSpaceMemoryBranches,
  spaceMemoryBranchForAsset,
} from '../space-memory-branches';

describe('spaceMemoryBranchForAsset', () => {
  it('maps call artifacts to calls and summaries to conversations', () => {
    expect(spaceMemoryBranchForAsset({ source: 'discussion_summary' })).toBe(
      'conversations',
    );
    expect(spaceMemoryBranchForAsset({ source: 'call_recording' })).toBe(
      'calls',
    );
    expect(spaceMemoryBranchForAsset({ source: 'call_transcript' })).toBe(
      'calls',
    );
  });

  it('keeps written memories in conversations with discussion summaries', () => {
    expect(spaceMemoryBranchForAsset({ source: 'memory' })).toBe(
      'conversations',
    );
  });

  it('keeps AI chat matrix media in ai and other uploads in files', () => {
    expect(
      spaceMemoryBranchForAsset({
        source: 'matrix_chat',
        documentLabel: 'AI Chat',
      }),
    ).toBe('ai');
    expect(spaceMemoryBranchForAsset({ source: 'matrix_chat' })).toBe('files');
    expect(spaceMemoryBranchForAsset({ source: 'proposal_upload' })).toBe(
      'files',
    );
  });
});

describe('countSpaceMemoryBranches', () => {
  it('totals each branch across the full catalog', () => {
    expect(
      countSpaceMemoryBranches([
        { source: 'discussion_summary' },
        { source: 'discussion_summary' },
        { source: 'call_recording' },
        { source: 'matrix_chat', documentLabel: 'AI Chat' },
        { source: 'memory' },
        { source: 'proposal_upload' },
      ]),
    ).toEqual({
      conversations: 3,
      calls: 1,
      ai: 1,
      files: 1,
    });
  });
});
