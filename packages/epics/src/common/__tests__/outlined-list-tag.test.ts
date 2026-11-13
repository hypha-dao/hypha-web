import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  OUTLINED_LIST_TAG_SIZE,
  OUTLINED_LIST_TAG_VARIANT,
  outlinedListTagClassName,
  outlinedListTagColor,
} from '../outlined-list-tag';

const badgeSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../coherence/components/signal-type-badge.tsx',
  ),
  'utf8',
);

describe('outlined list tags', () => {
  it('uses the design-system Badge outline', () => {
    expect(OUTLINED_LIST_TAG_VARIANT).toBe('outline');
    expect(OUTLINED_LIST_TAG_SIZE).toBe(1);

    const neutral = outlinedListTagClassName('neutral');
    expect(neutral).toContain('border');
    expect(neutral).toContain('border-border/60');
    expect(neutral).toContain('bg-transparent');
    expect(neutral).toContain('rounded-none');

    const success = outlinedListTagClassName('success');
    expect(success).toContain('border-success-8/70');
    expect(success).toContain('text-success-11');

    expect(outlinedListTagColor('insight')).toBe('accent');
    expect(outlinedListTagColor('tension')).toBe('warn');
    expect(outlinedListTagColor('unknown')).toBe('neutral');
  });

  it('is what the signal list type tag renders', () => {
    expect(badgeSource).toContain('variant={OUTLINED_LIST_TAG_VARIANT}');
    expect(badgeSource).toContain('size={OUTLINED_LIST_TAG_SIZE}');
    expect(badgeSource).toContain(
      'colorVariant={outlinedListTagColor(option.colorVariant)}',
    );
    expect(badgeSource).not.toContain(
      'border-[color-mix(in_oklab,currentColor_45%,transparent)]',
    );
  });
});
