import {
  listMemberHomeThreadItems,
  type MemberIntelligence,
} from '@hypha-platform/core/client';

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
export function formatMemberHomeFacts(
  home: MemberIntelligence,
  options?: { alreadyShown?: readonly string[] },
): string {
  const spaces = home.spaces.map((space) => space.title).join('; ') || 'none';
  const networkSlugs = new Set(
    (home.networkSignals ?? []).flatMap((signal) =>
      signal.slug ? [signal.slug] : [],
    ),
  );
  const waiting = listMemberHomeThreadItems(home).filter(
    (item) => !(item.kind === 'signal' && networkSlugs.has(item.slug)),
  );
  const listening = home.networkHorizon === 'network';
  const networkLines =
    !listening || (home.networkSignals ?? []).length === 0
      ? null
      : (home.networkSignals ?? [])
          .map((signal, index) => {
            const quoted = (value: string | null) =>
              (value ?? '').replace(/"/g, "'");
            return `${index + 1}. kind=signal slug=${
              signal.slug ?? ''
            } reasons=${signal.relevance.reasons.join(',')} title="${quoted(
              signal.title,
            )}" summary="${quoted(signal.description)}" space="${quoted(
              signal.spaceTitle,
            )}"`;
          })
          .join('\n');
  const waitingLines =
    waiting.length === 0
      ? listening
        ? 'Nothing in their spaces needs them. No judgement. Their horizon is already open. If a network signal is listed below, you may offer one. Otherwise invite them to activate a space. Do not imply the quiet is a problem. Do not call show_member_home_item unless you are offering that one network signal.'
        : 'Nothing in their spaces needs them. No judgement. Invite them to activate a space, or to open the horizon toggle so needs and opportunities from other spaces can reach them. Do not imply the quiet is a problem. Do not call show_member_home_item.'
      : waiting
          .map((item, index) => {
            const quoted = (value: string | null) =>
              (value ?? '').replace(/"/g, "'");
            return `${index + 1}. kind=${item.kind} slug=${
              item.slug
            } document=${item.documentKind} category=${quoted(
              item.category,
            )} creator="${quoted(item.creatorName)}" title="${quoted(
              item.title,
            )}" summary="${quoted(item.summary)}" space="${quoted(
              item.spaceTitle,
            )}"`;
          })
          .join('\n');
  const alreadyShown = (options?.alreadyShown ?? [])
    .map((key) => key.trim())
    .filter(Boolean);
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
    'Brief them like a friend who wants these people to help each other. Stay in motion until they ask to pause or the waiting list is done. One waiting item per reply, in the order below, and the next item is already the close of that reply once they answer: "The next proposal is…" or "Would you like to take a look at … now?" In the reply that introduces an item, call show_member_home_item once with its kind and slug. Use the member\'s name. Say who raised it and what they need, with one human detail if you have it, then ask if they want to pursue it: "Can you make it?" or "Ready to take a look?" Never "what would you like to focus on", never "if you want to do anything else, just let me know", and never a menu of the other items. If they say yes, be glad for the person they are helping, then name the next item the same way. If they pass, "All good", no guilt, and name the next item. Every so often, not every turn, and only while several items remain: "Would you like to pause for now, or continue going through what still needs you?" If they pause, stop. If they continue, the next item immediately. When the list is done, say so in one line and stop. Never vote, validate, accept, decline, or decide for them. Your words must be about the item you are offering. Do not call the tool for an item you are not talking about. The person taps the card.',
    `Person: ${personName(home.person)}.`,
    listening
      ? 'Horizon: listening to the network. After their own waiting items, you may offer one network signal below. In that reply call show_member_home_item once with its kind and slug. Name the space and why it might fit (location, interest, or experience). Offer one, not the list.'
      : 'Horizon: focused on their own spaces. Do not propose needs or opportunities from other spaces.',
    networkLines ? `Network signals:\n${networkLines}` : null,
    `Spaces (${home.counts.spaces}): ${spaces}.`,
    'Waiting items:',
    waitingLines,
    alreadyShown.length > 0
      ? `Already placed in earlier replies. Do not call show_member_home_item for these again unless the person asks: ${alreadyShown.join(
          ', ',
        )}.`
      : 'No card has been placed in this conversation yet.',
    `People who share a space, closest first: ${people}.`,
    home.wallet.preferredCurrency
      ? `Preferred currency: ${home.wallet.preferredCurrency}.`
      : 'Preferred currency: none set.',
    home.chatSpaceSlug
      ? `A usual chat space exists among the spaces above. It is not the only place they belong.`
      : 'They do not have a usual chat space yet.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}
