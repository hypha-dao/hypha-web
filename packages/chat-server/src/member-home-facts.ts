import type { MemberIntelligence } from '@hypha-platform/core/client';

function personName(person: {
  name: string | null;
  surname: string | null;
  nickname: string | null;
}): string {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname?.trim() || 'member';
}

/**
 * Records for the signed-in member. Appended after `buildSystemPrompt` so the
 * home assistant keeps the existing Hypha AI voice and still knows this person.
 */
export function formatMemberHomeFacts(home: MemberIntelligence): string {
  const spaces = home.spaces.map((space) => space.title).join('; ') || 'none';
  const proposals =
    home.proposals
      .map((proposal) => {
        const decision =
          proposal.web3ProposalId != null
            ? 'open for a member decision'
            : proposal.state ?? 'open';
        return `${proposal.title} (${proposal.spaceTitle}, ${decision})`;
      })
      .join('; ') || 'none';
  const signals =
    home.signals
      .map((signal) => `${signal.title} (${signal.spaceTitle})`)
      .join('; ') || 'none';
  const notifications =
    home.notifications
      .map((item) => `${item.title} (${item.spaceTitle})`)
      .join('; ') || 'none';
  const people =
    home.connections
      .map(
        (person) =>
          `${personName(person)} (shared spaces: ${person.sharedSpaceCount})`,
      )
      .join('; ') || 'none';

  return [
    'Member home facts for this signed-in person. These are records. Keep the Hypha AI voice from the instructions above.',
    'The member is on their personal home, across every space they belong to, not on a single space screen.',
    `Person: ${personName(home.person)}.`,
    `Spaces (${home.counts.spaces}): ${spaces}.`,
    `Proposals: ${proposals}.`,
    `Signals: ${signals}.`,
    `Notifications: ${notifications}.`,
    `People who share a space, closest first: ${people}.`,
    home.wallet.preferredCurrency
      ? `Preferred currency: ${home.wallet.preferredCurrency}.`
      : 'Preferred currency: none set.',
    home.chatSpaceSlug
      ? `A usual chat space exists among the spaces above. It is not the only place they belong.`
      : 'They do not have a usual chat space yet.',
  ].join('\n');
}
