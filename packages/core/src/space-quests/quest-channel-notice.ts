import { HYPHA_QUEST_HELPER_FIELD } from '../matrix/rich-reply';
import { QUEST_HELPER_AUTHOR_ID } from './constants';

/**
 * The one notice posted when a quest channel is provisioned.
 * The Matrix sender is still the org bot. The helper field tells the chat
 * to show it as the Quest Helper. Older events have no field and stay
 * labeled AI Agents.
 */
export function questChannelOpenedNotice(input: {
  acceptedDate: string;
  leadName: string;
  memberNames: readonly string[];
}): { body: string; extraContent: Record<string, string> } {
  const rosterLine = [
    input.leadName,
    ...input.memberNames.filter((name) => name !== input.leadName),
  ]
    .filter(Boolean)
    .join(', ');
  return {
    body: `Quest accepted · ${input.acceptedDate} — channel opened${
      rosterLine ? `\nParticipants: ${rosterLine}` : ''
    }`,
    extraContent: { [HYPHA_QUEST_HELPER_FIELD]: QUEST_HELPER_AUTHOR_ID },
  };
}
