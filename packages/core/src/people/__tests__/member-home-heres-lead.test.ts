import { describe, expect, it } from 'vitest';
import {
  memberHomeCardForSpeech,
  memberHomeSpeechConflictsWithItem,
  type MemberHomeThreadItem,
} from '../member-home-thread';

const item: MemberHomeThreadItem = {
  kind: 'signal',
  slug: 'fiat-balance',
  title: 'Fiat Balance',
  spaceSlug: 'hypha-energy',
  spaceTitle: 'Hypha Energy',
  action: 'validate',
  documentKind: 'signal',
  authoredByMember: true,
  category: null,
  summary: 'Update the fiat balance before the deadline.',
  creatorId: 1,
  creatorName: 'Alex Prate',
  creatorAvatarUrl: null,
  dueAt: new Date(Date.now() + 86400000).toISOString(),
};

const text =
  "Here's the card for your Fiat Balance thread, Alex — the deadline is close, so now's a good moment to update it.";

describe('home card with Here is lead-in', () => {
  it('does not treat Here-is as another creator', () => {
    expect(
      memberHomeSpeechConflictsWithItem(
        item,
        text,
        ['Hypha Energy'],
        ['Alex Prate'],
      ),
    ).toBe(false);
  });

  it('keeps the card from the tool call above that speech', () => {
    expect(
      memberHomeCardForSpeech({
        items: [item],
        message: {
          parts: [
            { type: 'text', text },
            {
              type: 'tool-show_member_home_item',
              state: 'output-available',
              input: { kind: 'signal', slug: 'fiat-balance' },
              output: { shown: true, kind: 'signal', slug: 'fiat-balance' },
            },
          ],
        },
        hinted: item,
        spaceTitles: ['Hypha Energy'],
      })?.slug,
    ).toBe('fiat-balance');
  });

  it('keeps the card from metadata when the model only wrote words', () => {
    expect(
      memberHomeCardForSpeech({
        items: [item],
        message: { parts: [{ type: 'text', text }] },
        hinted: item,
        spaceTitles: ['Hypha Energy'],
      })?.slug,
    ).toBe('fiat-balance');
  });
});
