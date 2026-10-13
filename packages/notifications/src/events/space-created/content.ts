/**
 * Pure content-selection for `space.created` — no DB/web3 imports (the resolver supplies the
 * creator's name, count and links). Email and push each use the OneSignal dashboard template when
 * `EMAIL_TEMPLATE_SPACE_CREATED` / `PUSH_TEMPLATE_SPACE_CREATED` is set, else the locally
 * rendered plain content (the fallback — an environment without the IDs still notifies).
 *
 * Gated on the base channel tags only (`subscribed` + `push`/`email`): there is no per-event
 * subscription tag for "I created a space" (it is a direct confirmation to the actor).
 */
import type { ContentBuilder } from '../../core/content-builder';
import { resolveEmailTemplate } from '../../core/email-template';
import { resolvePushTemplate } from '../../core/push-template';
import type { SpaceCreatedEvent } from '../../core/types';
import {
  emailSpaceCreationForCreator,
  pushSpaceCreationForCreator,
} from '../../template';

export const buildSpaceCreatedContent: ContentBuilder<SpaceCreatedEvent> = (
  event,
  recipient,
) => {
  const spacesCount = event.payload.spacesCount;
  const url = recipient.data?.url as string | undefined;
  const notificationSettingsUrl = recipient.data?.notificationSettingsUrl as
    | string
    | undefined;
  const customData = {
    user_name: recipient.displayName,
    spaces_count: String(spacesCount),
    url,
  };

  const plainEmail = emailSpaceCreationForCreator({ spacesCount });
  const plainPush = pushSpaceCreationForCreator({ spacesCount });

  return {
    channels: ['push', 'email'],
    requiredTags: {},
    content: {
      push: resolvePushTemplate(
        'PUSH_TEMPLATE_SPACE_CREATED',
        customData,
        url,
      ) ?? {
        kind: 'plain',
        contents: plainPush.contents,
        headings: plainPush.headings,
        url,
      },
      email: resolveEmailTemplate('EMAIL_TEMPLATE_SPACE_CREATED', {
        ...customData,
        notification_settings_url: notificationSettingsUrl,
      }) ?? {
        kind: 'plain',
        subject: plainEmail.subject,
        body: plainEmail.body,
      },
    },
  };
};
