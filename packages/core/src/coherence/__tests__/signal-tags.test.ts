import { describe, expect, it } from 'vitest';
import {
  collectExistingTags,
  displayTag,
  findNearDuplicateTags,
  isExistingTag,
  mergeTagInList,
  normalizeTagKey,
  tagsMatch,
  wouldCreateNearDuplicate,
} from '../signal-tags';

describe('normalizeTagKey', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeTagKey('  Memo  Randum ')).toBe('memo randum');
    expect(normalizeTagKey('Memorandum')).toBe('memorandum');
  });
});

describe('tagsMatch / findNearDuplicateTags', () => {
  it('treats case and surrounding whitespace as the same tag', () => {
    expect(tagsMatch('Memorandum', '  memorandum ')).toBe(true);
    expect(
      findNearDuplicateTags('MEMORANDUM', ['memo', 'Memorandum', 'brief']),
    ).toEqual(['Memorandum']);
  });

  it('does not treat distinct spellings as duplicates', () => {
    expect(isExistingTag('memo', ['memorandum'])).toBe(false);
  });
});

describe('collectExistingTags', () => {
  it('dedupes across cards and sorts by display label', () => {
    expect(
      collectExistingTags([
        ['Memorandum', 'brief'],
        ['  memorandum ', 'AI Signal'],
        null,
      ]),
    ).toEqual(['AI Signal', 'brief', 'Memorandum']);
  });
});

describe('mergeTagInList', () => {
  it('moves the source tag onto the surviving label and drops the duplicate', () => {
    expect(
      mergeTagInList(
        ['Memorandum', 'brief', 'memorandum'],
        'memorandum',
        'Memorandum',
      ),
    ).toEqual(['Memorandum', 'brief']);
  });

  it('is a no-op when the source tag is not present', () => {
    expect(mergeTagInList(['brief'], 'memorandum', 'Memo')).toEqual(['brief']);
  });
});

describe('wouldCreateNearDuplicate', () => {
  it('warns when the typed tag already exists on the board', () => {
    expect(wouldCreateNearDuplicate('memorandum', ['Memorandum'])).toBe(true);
  });

  it('does not warn when the tag is already selected', () => {
    expect(
      wouldCreateNearDuplicate('memorandum', ['Memorandum'], ['Memorandum']),
    ).toBe(false);
  });
});

describe('displayTag', () => {
  it('keeps the first meaningful spelling', () => {
    expect(displayTag('  Memorandum  ')).toBe('Memorandum');
  });
});
