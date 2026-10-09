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
  NotificationEmailContent,
} from '../../core/types';
import { TAG_MENTION_CONSENT } from '../../constants';
import {
  buildMentionEmailBody,
  getSafeMentionHref,
} from '../../actions/notify-chat-mention.utils';

/**
 * OneSignal dashboard template ("Chat - User Mentioned (email)") when `EMAIL_TEMPLATE_CHAT_MENTION`
 * is set; otherwise the locally-rendered HTML, so an environment without the ID configured still
 * sends the email. `customData` carries raw text — the template escapes it — and `url` is
 * http(s)-validated here because the template can't.
 */
function buildMentionEmail({
  heading,
  actorDisplayName,
  messagePreview,
  url,
  spaceTitle,
  notificationSettingsUrl,
}: {
  heading: string;
  actorDisplayName: string;
  messagePreview: string;
  url: string;
  spaceTitle?: string;
  notificationSettingsUrl?: string;
}): NotificationEmailContent {
  const templateId = process.env.EMAIL_TEMPLATE_CHAT_MENTION?.trim();
  if (templateId) {
    return {
      kind: 'template',
      templateId,
      customData: {
        actor_name: actorDisplayName,
        context_label: spaceTitle?.trim() || 'chat',
        message_preview: messagePreview,
        url: getSafeMentionHref(url),
        // Omitted when unset so the template's `| default:` fallback applies.
        ...(notificationSettingsUrl
          ? { notification_settings_url: notificationSettingsUrl }
          : {}),
      },
    };
  }

  return {
    kind: 'plain',
    subject: heading,
    body: buildMentionEmailBody({
      actorDisplayName,
      messagePreview,
      url,
      contextLabel: spaceTitle,
      notificationSettingsUrl,
    }),
  };
}

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
  const notificationSettingsUrl = recipient.data?.notificationSettingsUrl as
    | string
    | undefined;

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
        email: buildMentionEmail({
          heading,
          actorDisplayName,
          messagePreview,
          url,
          spaceTitle,
          notificationSettingsUrl,
        }),
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
