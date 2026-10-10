import {
  listMemberHomeThreadItems,
  memberHomeThreadItemKey,
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
  options?: { alreadyShown?: readonly string[]; passed?: readonly string[] },
): string {
  const spaces = home.spaces.map((space) => space.title).join('; ') || 'none';
  const networkSlugs = new Set(
    (home.networkSignals ?? []).flatMap((signal) =>
      signal.slug ? [signal.slug] : [],
    ),
  );
  const passed = new Set(
    (options?.passed ?? []).map((key) => key.trim()).filter(Boolean),
  );
  const waiting = listMemberHomeThreadItems(home).filter(
    (item) => !(item.kind === 'signal' && networkSlugs.has(item.slug)),
  );
  const stillWaiting = waiting.filter(
    (item) => !passed.has(memberHomeThreadItemKey(item)),
  );
  const passedItems = waiting.filter((item) =>
    passed.has(memberHomeThreadItemKey(item)),
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
    stillWaiting.length === 0
      ? passedItems.length > 0
        ? 'Nothing left in the queue. They already passed on the items below. Say that in one line. Do not ask what else they would like, and do not bring a passed item back.'
        : listening
        ? 'Nothing in their spaces needs them. No judgement. Their horizon is already open. If a network signal is listed below, you may offer one. Otherwise invite them to activate a space. Do not imply the quiet is a problem. Do not call show_member_home_item unless you are offering that one network signal.'
        : 'Nothing in their spaces needs them. No judgement. Invite them to activate a space, or to open the horizon toggle so needs and opportunities from other spaces can reach them. Do not imply the quiet is a problem. Do not call show_member_home_item.'
      : stillWaiting
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
    'Brief them like a friend who wants these people to help each other. Open on waiting item 1 in this shape, and no other shape: their name, the concrete stake (the deadline or the gap when the record actually has it), who raised it and why it matters to people, then "Want to take a look?" Example: "Hi Alex. The winter greenhouse vote closes in an hour and needs one more yes to reach quorum. Noor proposed it so 40 families keep getting fresh food through February. Want to take a look?" Use details from the records. Do not invent a deadline, a number, or a family. In that same reply call show_member_home_item once with its kind and slug. Do not introduce the queue, and do not ask if they want to take part. Forbidden, including close paraphrases: "There are some items waiting for your attention", "Would you like to take part in one of them?", "some items", "one of them".',
    'A no is final the first time. "I don\'t want to decide", "not now", "skip", or "no" drops that item. Do not ask again. Do not insist. Do not say you will not bring it up. The reply that hears the no names the next remaining waiting item in that same reply, and calls show_member_home_item for that next item: "The next proposal is…" or "Would you like to take a look at … now?"',
    'Asking for context or a discussion is not a no. "Give me the context", "tell me more", and "Discussion" stay on that item. Give the context and roll through the most recent discussion on it. Do not drop it and do not move on.',
    'Never end a reply by handing the agenda back. Forbidden, including close paraphrases: "That\'s completely fine", "if you need any assistance", "if you want to explore something else", "if there\'s anything else you\'d like to discuss", "just let me know".',
    'If they say yes, be glad for the person they are helping, then name the next remaining item the same way. Every so often, not every turn, and only while several items remain: "Would you like to pause for now, or continue going through what still needs you?" If they pause, stop. If they continue, the next item immediately. When the list is done, say so in one line. Never vote, validate, accept, decline, or decide for them. Your words must be about the item you are offering. Do not call the tool for an item you are not talking about. The person taps the card.',
    `Person: ${personName(home.person)}.`,
    listening
      ? 'Horizon: listening to the network. After their own waiting items, you may offer one network signal below. In that reply call show_member_home_item once with its kind and slug. Name the space and why it might fit (location, interest, or experience). Offer one, not the list.'
      : 'Horizon: focused on their own spaces. Do not propose needs or opportunities from other spaces.',
    networkLines ? `Network signals:\n${networkLines}` : null,
    `Spaces (${home.counts.spaces}): ${spaces}.`,
    passedItems.length > 0
      ? `Passed. They already said no. Do not mention these again: ${passedItems
          .map(
            (item) => `${memberHomeThreadItemKey(item)} "${item.title ?? ''}"`,
          )
          .join('; ')}.`
      : null,
    'Waiting items, most recent discussions first, then everything else they have not passed on. The reply starts with item 1. Do not summarise the list:',
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
