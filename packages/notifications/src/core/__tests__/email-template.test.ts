import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveEmailTemplate } from '../email-template';

describe('resolveEmailTemplate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns undefined when the env var is unset or blank (caller falls back to plain)', () => {
    vi.stubEnv('EMAIL_TEMPLATE_TEST', '');
    expect(resolveEmailTemplate('EMAIL_TEMPLATE_TEST', { a: 'x' })).toBe(
      undefined,
    );
    vi.stubEnv('EMAIL_TEMPLATE_TEST', '   ');
    expect(resolveEmailTemplate('EMAIL_TEMPLATE_TEST', { a: 'x' })).toBe(
      undefined,
    );
  });

  it('returns the template with trimmed id and drops empty/undefined custom data', () => {
    vi.stubEnv('EMAIL_TEMPLATE_TEST', ' tpl-1 ');
    expect(
      resolveEmailTemplate('EMAIL_TEMPLATE_TEST', {
        space_title: 'Hypha',
        proposal_title: undefined,
        url: '',
      }),
    ).toEqual({
      kind: 'template',
      templateId: 'tpl-1',
      customData: { space_title: 'Hypha' },
    });
  });
});
