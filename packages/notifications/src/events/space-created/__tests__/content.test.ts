import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSpaceCreatedContent } from '../content';
import type { Recipient, SpaceCreatedEvent } from '../../../core/types';

const event = (spacesCount: number): SpaceCreatedEvent => ({
  type: 'space.created',
  source: { kind: 'domain', entityType: 'space', entityId: '1' },
  context: { creatorWeb3Address: '0xabc' },
  payload: { spacesCount },
});

const recipient: Recipient = {
  personSlug: 'alice',
  displayName: 'Alice',
  role: 'creator',
  data: {
    spacesCount: 1,
    url: 'https://app.hypha.earth/en/my-spaces',
    notificationSettingsUrl:
      'https://app.hypha.earth/en/network/notification-centre',
  },
};

describe('buildSpaceCreatedContent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requests push + email gated on base tags only', () => {
    const result = buildSpaceCreatedContent(event(1), recipient);
    expect(result.channels).toEqual(['push', 'email']);
    expect(result.requiredTags).toEqual(['sub_ownActions']);
  });

  it('falls back to plain copy (singular) without the env vars, push carries the url', () => {
    vi.stubEnv('EMAIL_TEMPLATE_SPACE_CREATED', '');
    vi.stubEnv('PUSH_TEMPLATE_SPACE_CREATED', '');
    const result = buildSpaceCreatedContent(event(1), recipient);
    expect(result.content.email).toMatchObject({
      kind: 'plain',
      subject: 'Successful space creation',
    });
    const body = (result.content.email as { body: string }).body;
    expect(body).toContain('You&#39;ve successfully created a space.');
    expect(body).toContain('[unsubscribe_url]');
    expect(body).toContain('/en/network/notification-centre');
    expect(result.content.push).toMatchObject({
      kind: 'plain',
      contents: { en: "You've successfully created a space." },
      url: 'https://app.hypha.earth/en/my-spaces',
    });
  });

  it('pluralises the plain copy for several spaces', () => {
    vi.stubEnv('EMAIL_TEMPLATE_SPACE_CREATED', '');
    vi.stubEnv('PUSH_TEMPLATE_SPACE_CREATED', '');
    const result = buildSpaceCreatedContent(event(3), recipient);
    expect((result.content.email as { body: string }).body).toContain(
      'You&#39;ve successfully created 3 spaces.',
    );
    expect(result.content.push).toMatchObject({
      kind: 'plain',
      contents: { en: "You've successfully created 3 spaces." },
    });
  });

  it('uses the email and push templates when their vars are set', () => {
    vi.stubEnv('EMAIL_TEMPLATE_SPACE_CREATED', 'tpl-email');
    vi.stubEnv('PUSH_TEMPLATE_SPACE_CREATED', 'tpl-push');
    const result = buildSpaceCreatedContent(event(2), recipient);
    expect(result.content.email).toEqual({
      kind: 'template',
      templateId: 'tpl-email',
      customData: {
        user_name: 'Alice',
        spaces_count: '2',
        url: 'https://app.hypha.earth/en/my-spaces',
        notification_settings_url:
          'https://app.hypha.earth/en/network/notification-centre',
      },
    });
    expect(result.content.push).toEqual({
      kind: 'template',
      templateId: 'tpl-push',
      customData: {
        user_name: 'Alice',
        spaces_count: '2',
        url: 'https://app.hypha.earth/en/my-spaces',
      },
      url: 'https://app.hypha.earth/en/my-spaces',
    });
  });
});
