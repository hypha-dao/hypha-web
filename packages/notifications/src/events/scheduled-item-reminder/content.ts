/**
 * Pure content-selection for `scheduled_item.reminder`. Calls and meetings are gated on
 * `consent_meetings`; other item types keep the previous base-tags-only gating.
 */
import { TAG_MEETING_CONSENT } from '../../constants/tags';
import type { ContentBuilder } from '../../core/content-builder';
import type { ScheduledItemReminderEvent } from '../../core/types';
import { emailScheduledItemReminder, safeHref } from '../../template';

export const buildScheduledItemReminderContent: ContentBuilder<
  ScheduledItemReminderEvent
> = (event) => {
  const { title, spaceTitle, whenLabel, url, settingsUrl, channels } =
    event.payload;
  const email = emailScheduledItemReminder({
    title,
    spaceTitle,
    whenLabel,
    url,
    settingsUrl,
  });
  const href = safeHref(url);
  const gated =
    event.context.itemType === 'call' || event.context.itemType === 'meeting';

  return {
    channels,
    requiredTags: gated ? [TAG_MEETING_CONSENT] : [],
    content: {
      push: channels.includes('push')
        ? {
            kind: 'plain',
            headings: { en: email.subject },
            contents: { en: email.preheader ?? '' },
            url: href === '#' ? undefined : href,
          }
        : undefined,
      email: channels.includes('email')
        ? {
            kind: 'plain',
            subject: email.subject,
            preheader: email.preheader,
            body: email.body,
          }
        : undefined,
    },
  };
};
