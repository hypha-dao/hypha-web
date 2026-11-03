import { describe, expect, it } from 'vitest';
import { resolveAdoptedStageSlug } from '../resolve-adopted-stage-slug';

const defaultStages = [
  { slug: 'Identified', name: 'Identified' },
  { slug: 'Won', name: 'Won' },
  { slug: 'Lost', name: 'Lost' },
];

describe('resolveAdoptedStageSlug', () => {
  it('keeps a saved stage slug when the name matches an unused default', () => {
    expect(
      resolveAdoptedStageSlug({
        stage: { slug: 'custom_open' },
        name: 'Won',
        siblingSlugs: ['Identified'],
        unsavedPlaceholderSlugs: new Set(),
        defaultStages,
      }),
    ).toBe('custom_open');
  });

  it('does not treat a saved new_stage slug as a placeholder', () => {
    expect(
      resolveAdoptedStageSlug({
        stage: { slug: 'new_stage' },
        name: 'Won',
        siblingSlugs: ['Identified'],
        unsavedPlaceholderSlugs: new Set(),
        defaultStages,
      }),
    ).toBe('new_stage');
  });

  it('lets an unsaved placeholder adopt an unused default slug', () => {
    expect(
      resolveAdoptedStageSlug({
        stage: { slug: 'new_stage' },
        name: 'Won',
        siblingSlugs: ['Identified'],
        unsavedPlaceholderSlugs: new Set(['new_stage']),
        defaultStages,
      }),
    ).toBe('Won');
  });

  it('keeps the placeholder slug when the default slug is already used', () => {
    expect(
      resolveAdoptedStageSlug({
        stage: { slug: 'new_stage' },
        name: 'Won',
        siblingSlugs: ['Won'],
        unsavedPlaceholderSlugs: new Set(['new_stage']),
        defaultStages,
      }),
    ).toBe('new_stage');
  });

  it('does not let a terminal placeholder adopt Won', () => {
    expect(
      resolveAdoptedStageSlug({
        stage: { slug: 'new_stage', terminal: 'lost' },
        name: 'Won',
        siblingSlugs: ['Identified'],
        unsavedPlaceholderSlugs: new Set(['new_stage']),
        defaultStages,
      }),
    ).toBe('new_stage');
  });
});
