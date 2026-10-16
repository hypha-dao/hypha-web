import { describe, expect, it } from 'vitest';

import { NOTIFICATION_SUBSCRIPTIONS } from '../options';
import { isTagDisabled, SUBSCRIPTION_TAGS, TAGS } from '../tags';

describe('preference groups (#2549 D3)', () => {
  it('exposes exactly six unique group tags', () => {
    expect(SUBSCRIPTION_TAGS).toHaveLength(6);
    expect(new Set(SUBSCRIPTION_TAGS).size).toBe(6);
  });

  it('has one Notification Centre entry per group, all on by default', () => {
    expect(NOTIFICATION_SUBSCRIPTIONS.map((s) => s.tagName).sort()).toEqual(
      [...SUBSCRIPTION_TAGS].sort(),
    );
    expect(NOTIFICATION_SUBSCRIPTIONS.every((s) => s.tagValue)).toBe(true);
  });

  it('lists every group tag in TAGS', () => {
    for (const tag of SUBSCRIPTION_TAGS) expect(TAGS).toContain(tag);
  });
});

describe('isTagDisabled (#2549 D4)', () => {
  it.each([
    [undefined, false],
    ['true', false],
    ['disabled', true],
    ['false', true],
  ])('%j -> disabled=%s', (value, disabled) => {
    expect(isTagDisabled(value)).toBe(disabled);
  });
});
