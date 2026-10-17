/**
 * Pure content-selection for `space.created` — no DB/web3 imports (the resolver supplies the
 * creator's name, count and links). Email and push are rendered in code (`template/`) - no OneSignal
 * dashboard templates (#2549).
 *
 * Gated on `sub_ownActions` (own-action confirmations, disabled by default for new subscribers —
 * #2549 D3/D5) on top of the base channel tags.
 */
import { TAG_SUB_OWN_ACTIONS } from '../../constants';
import type { ContentBuilder } from '../../core/content-builder';
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
  const plainEmail = emailSpaceCreationForCreator({
    spacesCount,
    userName: recipient.displayName,
    url,
    settingsUrl: notificationSettingsUrl,
  });
  const plainPush = pushSpaceCreationForCreator({ spacesCount });

  return {
    channels: ['push', 'email'],
    requiredTags: [TAG_SUB_OWN_ACTIONS],
    content: {
      push: {
        kind: 'plain',
        contents: plainPush.contents,
        headings: plainPush.headings,
        url,
      },
      email: {
        kind: 'plain',
        subject: plainEmail.subject,
        preheader: plainEmail.preheader,
        body: plainEmail.body,
      },
    },
  };
};
