/**
 * Pure content-selection for `chat.message` / `chat.mention` — no DB imports; `resolver.ts`
 * precomputes `actorDisplayName`/`messagePreview`/`url`/`spaceTitle` (identical for every
 * recipient of a given message, so one lookup covers everyone) and attaches them to each
 * `Recipient.data`.
 *
 * Channel split (D15, 2026-09-22): `chat.message` (the all-messages default, D1) requests
 * `push` only — email is reserved for the naturally low-volume `chat.mention` case, so there is
 * no email-flood risk from "notify on every message" and no digest queue is needed.
 */
import type { ContentBuilder } from '../../core/content-builder';
import type {
  ChatNotificationEvent,
  NotificationContent,
} from '../../core/types';
import { TAG_MENTION_CONSENT } from '../../constants';
import { buildMentionEmailBody } from '../../actions/notify-chat-mention.utils';

export const buildChatContent: ContentBuilder<ChatNotificationEvent> = (
  event,
  recipient,
): NotificationContent => {
  const actorDisplayName =
    (recipient.data?.actorDisplayName as string | undefined) ?? 'Someone';
  const messagePreview =
    (recipient.data?.messagePreview as string | undefined) ?? '';
  const url = recipient.data?.url as string;
  const spaceTitle = recipient.data?.spaceTitle as string | undefined;

  if (event.type === 'chat.mention') {
    const heading = `${actorDisplayName} mentioned you`;
    return {
      channels: ['push', 'email'],
      requiredTags: { [TAG_MENTION_CONSENT]: 'true' },
      content: {
        push: {
          kind: 'plain',
          headings: { en: heading },
          contents: {
            en: messagePreview || `${actorDisplayName} mentioned you in chat.`,
          },
          url,
        },
        email: {
          kind: 'plain',
          subject: heading,
          body: buildMentionEmailBody({
            actorDisplayName,
            messagePreview,
            url,
            contextLabel: spaceTitle,
          }),
        },
      },
    };
  }

  // chat.message (all-messages)
  return {
    channels: ['push'],
    requiredTags: {},
    content: {
      push: {
        kind: 'plain',
        headings: { en: spaceTitle ?? 'Hypha' },
        contents: { en: `${actorDisplayName}: ${messagePreview}` },
        url,
      },
    },
  };
};
