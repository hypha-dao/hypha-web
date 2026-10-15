import { TAG_SUB_SIGNALS } from '../../constants';
import type { ContentBuilder } from '../../core/content-builder';
import type { SignalBoardNoticeEvent } from '../../core/types';
import { buildSignalNoticeEmail } from './email';

export const buildSignalNoticeContent: ContentBuilder<
  SignalBoardNoticeEvent
> = (event, recipient) => {
  const email = buildSignalNoticeEmail({
    kind: event.context.kind,
    signalTitle: event.payload.signalTitle,
    actorDisplayName: recipient.data?.actorDisplayName as string | undefined,
    dueAt: event.payload.dueAt ?? (recipient.data?.dueAt as string | null),
    url: (recipient.data?.url as string) ?? '#',
    settingsUrl: recipient.data?.notificationSettingsUrl as string | undefined,
  });

  return {
    channels: ['email'],
    requiredTags: [TAG_SUB_SIGNALS],
    content: {
      email: {
        kind: 'plain',
        subject: email.subject,
        preheader: email.preheader,
        body: email.body,
      },
    },
  };
};
