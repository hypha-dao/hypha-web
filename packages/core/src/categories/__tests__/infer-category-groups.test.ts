import { describe, expect, it } from 'vitest';
import { inferCategoryGroupsFromText } from '../infer-category-groups';

describe('inferCategoryGroupsFromText', () => {
  it('maps innovation-focused ecosystems to Innovation & Tech', () => {
    expect(
      inferCategoryGroupsFromText(
        'IDEAD is focused on innovation and technology startups across the network',
      ),
    ).toEqual(['technology']);
  });

  it('maps climate organisations to Environment', () => {
    expect(
      inferCategoryGroupsFromText(
        'Adelaide Climate Action Week stewards working on climate and sustainability',
      ),
    ).toContain('environment');
  });

  it('can assign a secondary group when scores are close', () => {
    const groups = inferCategoryGroupsFromText(
      'A DAO building governance and finance tooling for community networks',
    );
    expect(groups).toContain('governance');
  });

  it('defaults to technology when no keywords match', () => {
    expect(inferCategoryGroupsFromText('')).toEqual(['technology']);
  });
});
