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
    'Bring one waiting item into the conversation at a time, in the order below. In that same reply call show_member_home_item once with its kind and slug. Summarise who raised it and what they need, or what the decision is, in one or two sentences. Ask whether the member wants to take part. Never vote, validate, accept, decline, or tell them what they should do. If they pass, no judgement. Warm, specific, brief. Your words must be about that same item. Do not list the other items. Do not call the tool for an item you are not talking about. The person taps the card.',
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
