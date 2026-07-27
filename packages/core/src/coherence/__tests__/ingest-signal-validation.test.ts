import { describe, expect, it } from 'vitest';

import {
  schemaIngestSignal,
  schemaIngestedSignalUpvote,
  schemaPatchIngestedSignal,
} from '../validation';

const wallet = '0x1111111111111111111111111111111111111111';

const validSignal = {
  title: 'Riverside cleanup needs funding',
  description: 'Twelve members flagged the riverside site this week.',
  type: 'Opportunity',
  author: { walletAddress: wallet },
};

describe('schemaIngestSignal', () => {
  it('defaults priority and tags so a minimal payload is enough', () => {
    const parsed = schemaIngestSignal.parse(validSignal);

    expect(parsed.priority).toBe('medium');
    expect(parsed.tags).toEqual([]);
  });

  it('requires a wallet or email when an author is given', () => {
    expect(() =>
      schemaIngestSignal.parse({ ...validSignal, author: {} }),
    ).toThrow(/walletAddress or email/);
  });

  it('allows omitting the author, to publish as the space', () => {
    const parsed = schemaIngestSignal.parse({
      ...validSignal,
      author: undefined,
    });
    expect(parsed.author).toBeUndefined();
  });

  it('accepts an email author', () => {
    const parsed = schemaIngestSignal.parse({
      ...validSignal,
      author: { email: 'Member@Example.org' },
    });
    expect(parsed.author?.email).toBe('Member@Example.org');
  });

  it('rejects a malformed wallet address', () => {
    expect(() =>
      schemaIngestSignal.parse({
        ...validSignal,
        author: { walletAddress: '0xnope' },
      }),
    ).toThrow();
  });

  it('rejects unknown fields so typos fail loudly', () => {
    expect(() =>
      schemaIngestSignal.parse({ ...validSignal, prioriy: 'high' }),
    ).toThrow();
  });

  it('does not let an integration set Hypha-side assignees', () => {
    expect(() =>
      schemaIngestSignal.parse({ ...validSignal, assigneeIds: [1, 2] }),
    ).toThrow();
  });

  it('rejects signal types the Hypha editor cannot round-trip', () => {
    expect(() =>
      schemaIngestSignal.parse({ ...validSignal, type: 'Proposal' }),
    ).toThrow();
  });

  it('only accepts workflow slugs in the space slug format', () => {
    expect(
      schemaIngestSignal.parse({
        ...validSignal,
        progressStatus: 'in_progress',
      }).progressStatus,
    ).toBe('in_progress');
    expect(() =>
      schemaIngestSignal.parse({ ...validSignal, board: 'Not A Slug' }),
    ).toThrow();
  });

  it('deduplicates tags case-insensitively', () => {
    const parsed = schemaIngestSignal.parse({
      ...validSignal,
      tags: ['Governance', 'governance', 'Policy'],
    });
    expect(parsed.tags).toEqual(['Governance', 'Policy']);
  });
});

describe('schemaPatchIngestedSignal', () => {
  it('requires at least one field', () => {
    expect(() => schemaPatchIngestedSignal.parse({})).toThrow(
      /at least one field/,
    );
  });

  it('leaves dueAt undefined when absent so a patch does not clear it', () => {
    const parsed = schemaPatchIngestedSignal.parse({ priority: 'high' });
    expect(parsed.dueAt).toBeUndefined();
    expect(parsed.title).toBeUndefined();
  });

  it('distinguishes an explicit null dueAt as "clear it"', () => {
    expect(schemaPatchIngestedSignal.parse({ dueAt: null }).dueAt).toBeNull();
  });

  it('parses an ISO dueAt into a Date', () => {
    const parsed = schemaPatchIngestedSignal.parse({
      dueAt: '2026-08-01T10:00:00.000Z',
    });
    expect(parsed.dueAt).toBeInstanceOf(Date);
  });
});

describe('schemaIngestedSignalUpvote', () => {
  it('requires a voter wallet', () => {
    expect(() => schemaIngestedSignalUpvote.parse({})).toThrow();
  });

  it('accepts a percentage within 1..100', () => {
    const parsed = schemaIngestedSignalUpvote.parse({
      voter: { walletAddress: wallet },
      votingPowerPercent: 25,
    });
    expect(parsed.votingPowerPercent).toBe(25);
  });

  it('rejects an out-of-range percentage', () => {
    expect(() =>
      schemaIngestedSignalUpvote.parse({
        voter: { walletAddress: wallet },
        votingPowerPercent: 150,
      }),
    ).toThrow();
  });
});
