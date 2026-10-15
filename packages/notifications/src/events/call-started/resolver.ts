import { buildNotificationSettingsUrl } from '../../core/notification-settings-url';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type { CallStartedEvent, Recipient } from '../../core/types';
import { resolveCallStartedRecipientSlugs } from '../../actions/notify-call-started.recipients';

export function buildCallStartedEvent(input: {
  actorSlug?: string;
  actorDisplayName?: string;
  spaceSlug: string;
  contextLabel?: string;
  scope: 'space_members' | 'signal_team';
  targetMatrixUserIds?: string[];
  url: string;
}): CallStartedEvent {
  return {
    type: 'call.started',
    source: {
      kind: 'domain',
      entityType: 'call',
      entityId: `${input.spaceSlug}:${Date.now()}`,
    },
    context: {
      spaceSlug: input.spaceSlug,
      scope: input.scope,
      actorSlug: input.actorSlug,
      targetMatrixUserIds: input.targetMatrixUserIds,
    },
    payload: {
      actorDisplayName: input.actorDisplayName?.trim() || 'Someone',
      contextLabel: input.contextLabel?.trim() || 'chat',
      url: input.url,
      settingsUrl: buildNotificationSettingsUrl(),
    },
  };
}

/** Same recipient scoping as the former `notifyCallStartedAction` (signal team, else space members; actor excluded). */
export const resolveCallStartedRecipients: RecipientResolver<
  CallStartedEvent
> = async (event) => {
  const slugs = await resolveCallStartedRecipientSlugs({
    scope: event.context.scope,
    spaceSlug: event.context.spaceSlug,
    actorSlug: event.context.actorSlug?.trim(),
    targetMatrixUserIds: event.context.targetMatrixUserIds,
  });
  return slugs.map((personSlug): Recipient => ({ personSlug, role: 'member' }));
};
