/**
 * Pure content-selection for `call.started` — push + email, gated on `consent_meetings` (#2549 D10).
 * Content is recipient-independent so `dispatch()` groups it into one send.
 */
import { TAG_MEETING_CONSENT } from '../../constants';
import type { ContentBuilder } from '../../core/content-builder';
import type { CallStartedEvent } from '../../core/types';
import { emailCallStarted, safeHref } from '../../template';

export const buildCallStartedContent: ContentBuilder<CallStartedEvent> = (
  event,
) => {
  const { actorDisplayName, contextLabel, url, settingsUrl } = event.payload;
  const email = emailCallStarted({
    actorName: actorDisplayName,
    contextLabel,
    url,
    settingsUrl,
  });
  const href = safeHref(url);

  return {
    channels: ['push', 'email'],
    requiredTags: [TAG_MEETING_CONSENT],
    content: {
      push: {
        kind: 'plain',
        headings: { en: email.subject },
        contents: { en: email.preheader ?? '' },
        url: href === '#' ? undefined : href,
      },
      email: {
        kind: 'plain',
        subject: email.subject,
        preheader: email.preheader,
        body: email.body,
      },
    },
  };
};
