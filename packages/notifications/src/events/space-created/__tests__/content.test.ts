import { describe, expect, it } from 'vitest';

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
  it('requests push + email gated on base tags only', () => {
    const result = buildSpaceCreatedContent(event(1), recipient);
    expect(result.channels).toEqual(['push', 'email']);
    expect(result.requiredTags).toEqual(['sub_ownActions']);
  });

  it('renders plain copy (singular), push carries the url', () => {
    const result = buildSpaceCreatedContent(event(1), recipient);
    expect(result.content.email).toMatchObject({
      kind: 'plain',
      subject: 'Your space has been created',
    });
    const body = (result.content.email as { body: string }).body;
    expect(body).toContain(
      'You&rsquo;ve successfully created a space in the Hypha network. 🚀',
    );
    expect(body).toContain('Hey Alice,');
    expect(body).toContain('Go to my spaces');
    expect(body).toContain('[unsubscribe_url]');
    expect(body).toContain('/en/network/notification-centre');
    expect(result.content.push).toMatchObject({
      kind: 'plain',
      contents: { en: "You've successfully created a space." },
      url: 'https://app.hypha.earth/en/my-spaces',
    });
  });

  it('pluralises the plain copy for several spaces', () => {
    const result = buildSpaceCreatedContent(event(3), recipient);
    expect((result.content.email as { body: string }).body).toContain(
      'You&rsquo;ve successfully created <strong>3</strong> spaces in the Hypha network. 🚀',
    );
    expect(result.content.push).toMatchObject({
      kind: 'plain',
      contents: { en: "You've successfully created 3 spaces." },
    });
  });
});
