import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolvePushTemplate } from '../push-template';

describe('resolvePushTemplate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns undefined when the env var is unset or blank (caller falls back to plain)', () => {
    vi.stubEnv('PUSH_TEMPLATE_TEST', '');
    expect(resolvePushTemplate('PUSH_TEMPLATE_TEST', { a: 'x' })).toBe(
      undefined,
    );
  });

  it('returns the template with trimmed id, the launch url and non-empty custom data', () => {
    vi.stubEnv('PUSH_TEMPLATE_TEST', ' tpl-1 ');
    expect(
      resolvePushTemplate(
        'PUSH_TEMPLATE_TEST',
        { space_title: 'Hypha', proposal_title: undefined, url: '' },
        'https://app.hypha.earth/en/dho/x/agreements',
      ),
    ).toEqual({
      kind: 'template',
      templateId: 'tpl-1',
      customData: { space_title: 'Hypha' },
      url: 'https://app.hypha.earth/en/dho/x/agreements',
    });
  });
});
