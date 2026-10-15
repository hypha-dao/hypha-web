/**
 * Pure content-selection for `signal.assigned` — no DB imports; `resolver.ts` attaches
 * `spaceTitle`/`actorDisplayName`/`url` to each `Recipient.data` since they're the same for
 * every assignee. Email only — the original action never sent push for this type.
 */
import { TAG_SUB_SIGNALS } from '../../constants';
import type { ContentBuilder } from '../../core/content-builder';
import type { SignalAssignedEvent } from '../../core/types';
import { emailSignalAssigned } from '../../template';

export const buildSignalAssignedContent: ContentBuilder<SignalAssignedEvent> = (
  event,
  recipient,
) => {
  const spaceTitle = recipient.data?.spaceTitle as string | undefined;
  const actorDisplayName = recipient.data?.actorDisplayName as
    | string
    | undefined;
  const url = recipient.data?.url as string;
  const email = emailSignalAssigned({
    signalTitle: event.payload.signalTitle,
    spaceTitle,
    actorName: actorDisplayName,
    dueAt: event.payload.dueAt ?? (recipient.data?.dueAt as string | null),
    url,
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
