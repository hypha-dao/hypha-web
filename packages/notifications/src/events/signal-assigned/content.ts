/**
 * Pure content-selection for `signal.assigned` — no DB imports; `resolver.ts` attaches
 * `spaceTitle`/`actorDisplayName`/`url` to each `Recipient.data` since they're the same for
 * every assignee. Email only — the original action never sent push for this type.
 */
import type { ContentBuilder } from '../../core/content-builder';
import type { SignalAssignedEvent } from '../../core/types';
import {
  buildSignalAssignedEmailBody,
  buildSignalAssignedEmailSubject,
} from '../../actions/notify-signal-assigned.utils';

export const buildSignalAssignedContent: ContentBuilder<SignalAssignedEvent> = (
  event,
  recipient,
) => {
  const spaceTitle = recipient.data?.spaceTitle as string | undefined;
  const actorDisplayName = recipient.data?.actorDisplayName as
    | string
    | undefined;
  const url = recipient.data?.url as string;
  const title = event.payload.signalTitle.trim() || 'a signal';

  return {
    channels: ['email'],
    requiredTags: {},
    content: {
      email: {
        kind: 'plain',
        subject: buildSignalAssignedEmailSubject(title),
        body: buildSignalAssignedEmailBody({
          signalTitle: title,
          spaceTitle,
          actorDisplayName,
          url,
        }),
      },
    },
  };
};
