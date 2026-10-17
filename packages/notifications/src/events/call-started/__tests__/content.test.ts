import { describe, expect, it } from 'vitest';

import { buildCallStartedContent } from '../content';
import type { CallStartedEvent, Recipient } from '../../../core/types';
import { TAG_MEETING_CONSENT } from '../../../constants';

const event = (
  payload: Partial<CallStartedEvent['payload']> = {},
): CallStartedEvent => ({
  type: 'call.started',
  source: { kind: 'domain', entityType: 'call', entityId: 'acme:1' },
  context: { spaceSlug: 'acme', scope: 'space_members', actorSlug: 'alice' },
  payload: {
    actorDisplayName: 'Alice <A>',
    contextLabel: 'General',
    url: 'https://app.hypha.earth/en/dho/acme?joinCall=1',
    settingsUrl: 'https://app.hypha.earth/en/network/notification-centre',
    ...payload,
  },
});

const recipient: Recipient = { personSlug: 'bob', role: 'member' };

describe('buildCallStartedContent', () => {
  it('requests push + email gated on consent_meetings', () => {
    const result = buildCallStartedContent(event(), recipient);
    expect(result.channels).toEqual(['push', 'email']);
    expect(result.requiredTags).toEqual([TAG_MEETING_CONSENT]);
  });

  it('renders matching push and layout email copy', () => {
    const { content } = buildCallStartedContent(event(), recipient);
    expect(content.push).toMatchObject({
      kind: 'plain',
      headings: { en: 'Alice <A> started a call' },
      contents: { en: 'Join the call in General.' },
      url: 'https://app.hypha.earth/en/dho/acme?joinCall=1',
    });
    const email = content.email as {
      subject: string;
      preheader: string;
      body: string;
    };
    expect(email.subject).toBe('Alice <A> started a call');
    expect(email.preheader).toBe('Join the call in General.');
    expect(email.body).toContain('Alice &lt;A&gt;');
    expect(email.body).toContain('>Join call<');
    expect(email.body).toContain('[unsubscribe_url]');
  });

  it('drops the push url and neutralises the CTA for non-http(s) urls', () => {
    const { content } = buildCallStartedContent(
      event({ url: 'javascript:alert(1)' }),
      recipient,
    );
    expect((content.push as { url?: string }).url).toBeUndefined();
    expect((content.email as { body: string }).body).toContain(
      'class="cta" href="#"',
    );
  });
});
