import { describe, expect, it } from 'vitest';
import {
  mentionMarkdown,
  newlyMentionedSlugs,
  parseSignalMentions,
  personProfileHref,
} from '../signal-mentions';

describe('parseSignalMentions', () => {
  it('reads markdown mention links and locale-prefixed profile hrefs', () => {
    const text =
      'Ask [@Ada Lovelace](/profile/ada) and [@Grace](/en/profile/grace) please.';
    expect(parseSignalMentions(text)).toEqual([
      { slug: 'ada', label: 'Ada Lovelace', href: '/profile/ada' },
      { slug: 'grace', label: 'Grace', href: '/profile/grace' },
    ]);
  });

  it('dedupes the same person mentioned twice', () => {
    expect(
      parseSignalMentions(
        '[@Ada](/profile/ada) and again [@Ada Lovelace](/profile/ada)',
      ),
    ).toEqual([{ slug: 'ada', label: 'Ada', href: '/profile/ada' }]);
  });
});

describe('newlyMentionedSlugs', () => {
  it('returns only people added in the new text', () => {
    expect(
      newlyMentionedSlugs(
        'Hi [@Ada](/profile/ada)',
        'Hi [@Ada](/profile/ada) and [@Grace](/profile/grace)',
      ),
    ).toEqual(['grace']);
  });
});

describe('mentionMarkdown', () => {
  it('writes a portable profile link', () => {
    expect(mentionMarkdown('Ada Lovelace', 'ada')).toBe(
      '[@Ada Lovelace](/profile/ada)',
    );
    expect(personProfileHref('ada', 'en')).toBe('/en/profile/ada');
  });
});
