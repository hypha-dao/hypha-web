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
  options?: {
    alreadyShown?: readonly string[];
    passed?: readonly string[];
    deferred?: readonly string[];
    /** Brought back once in this conversation. Do not ask again yet. */
    recalled?: readonly string[];
    /** They answered the bring-back. Leave these out of the queue. */
    settled?: readonly string[];
    /** Deferred by the message this reply is answering. Do not bring it back yet. */
    held?: string | null;
  },
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
  const deferredKeys = new Set(
    (options?.deferred ?? []).map((key) => key.trim()).filter(Boolean),
  );
  const recalledKeys = new Set(
    (options?.recalled ?? []).map((key) => key.trim()).filter(Boolean),
  );
  const settledKeys = new Set(
    (options?.settled ?? []).map((key) => key.trim()).filter(Boolean),
  );
  const held = options?.held?.trim() || null;
  const waiting = listMemberHomeThreadItems(home).filter(
    (item) => !(item.kind === 'signal' && networkSlugs.has(item.slug)),
  );
  const stillWaiting = waiting.filter((item) => {
    const key = memberHomeThreadItemKey(item);
    return (
      !passed.has(key) &&
      !deferredKeys.has(key) &&
      !recalledKeys.has(key) &&
      !settledKeys.has(key)
    );
  });
  const deferredItems = waiting.filter((item) =>
    deferredKeys.has(memberHomeThreadItemKey(item)),
  );
  const recalledItems = waiting.filter((item) =>
    recalledKeys.has(memberHomeThreadItemKey(item)),
  );
  const holding = Boolean(held && deferredKeys.has(held));
  const recall =
    !holding && stillWaiting.length === 0 ? deferredItems[0] : undefined;
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
      ? recall
        ? `Nothing fresh is waiting. Bring back the deferred item once: kind=${recall.kind} slug=${recall.slug}. They said not now earlier. Ask "is this a good time?" Do not present it as new.`
        : holding
        ? 'They just said not now, and nothing else is waiting. One line that you will come back to it and ask if it is a good time. Do not ask that now. Do not call show_member_home_item.'
        : recalledItems.length > 0
        ? 'Already asked once if this is a good time. Do not ask again in this conversation. If they just agreed, be glad and name the next item. If nothing else is waiting, say so in one line. Do not present the item as new.'
        : passedItems.length > 0
        ? 'Nothing left in the queue. They already passed on the items below. Say that in one line. Do not ask what else they would like, and do not bring a passed item back.'
        : listening
        ? 'Nothing in their spaces needs them. No judgement. Their horizon is already open. If a network signal is listed below, you may offer one. Otherwise invite them to activate a space. Do not imply the quiet is a problem. Do not call show_member_home_item unless you are offering that one network signal.'
        : 'Nothing in their spaces needs them. No judgement. Invite them to activate a space. Do not imply the quiet is a problem. Do not call show_member_home_item.'
      : stillWaiting
          .map((item, index) => {
            const quoted = (value: string | null) =>
              (value ?? '').replace(/"/g, "'");
            return `${index + 1}. kind=${item.kind} slug=${
              item.slug
            } document=${item.documentKind} action=${
              item.action
            } category=${quoted(item.category)} creator="${quoted(
              item.creatorName,
            )}" title="${quoted(item.title)}" summary="${quoted(
              item.summary,
            )}" space="${quoted(item.spaceTitle)}"`;
          })
          .join('\n');
  const recallKey = recall ? memberHomeThreadItemKey(recall) : null;
  const alreadyShown = (options?.alreadyShown ?? [])
    .map((key) => key.trim())
    .filter((key) => Boolean(key) && key !== recallKey);
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
    'Stay on the work: collaboration, the network, spaces, the business of those spaces, and people helping each other. A recipe or any everyday aside may be one short joke, then return to the waiting item in the same reply. Never make a recipe, a how-to, or a list of ingredients the thing you are proposing.',
    'Brief them like a friend who wants these people to help each other. High integrity, helpful, empathic, and at the right distance. Never intrusive. Never curious. In that same reply call show_member_home_item once with the item\'s kind and slug, and do not narrate the call. When action=decision (a proposal, an invite, a vote): one or two sentences of context only — their name, who it concerns, the space, and any token the record names. Then stop. The card is what they look at. You are not in the decision, and you do not need to know if they approve. Do not steer. Do not say you will show it. Do not restate its title. Do not ask a question. Forbidden, including close paraphrases: "I\'ll show you the proposal now.", "Here\'s the proposal titled", "Could you let me know if you approve", "We need your approval", "Can you review". When someone needs a hand (action is not decision): their name, who needs them, the concrete stake, any token the record names, then one practical ask. Example: "Hi Alex. Teo is looking for a quick look at the greenhouse budget before the vote wraps up. It is a 15 minute call with 30 HUM attached. Can you jump on with him?" When the summary names one token or several, say each of them. When it names none, do not invent a token, an amount, a duration, or a jar. Do not invent a deadline or a family. Do not introduce the queue, and do not ask if they want to take part. Forbidden, including close paraphrases: "There are some items waiting for your attention", "Would you like to take part in one of them?", "some items", "one of them".',
    'A no is final the first time. "I don\'t want to decide", "no thanks", or "no" drops that item. Do not ask again. Do not insist. Do not say you will not bring it up. The reply that hears the no names the next remaining waiting item in that same reply, and calls show_member_home_item for that next item.',
    'Not now is not a no. Remember it and do not offer it again in that same reply. Name the next fresh item instead. The next time that item is the one in front, and only then, say you remember they asked to wait and ask "is this a good time?" If they say not now again, leave it. Do not loop.',
    'Asking for context or a discussion is not a no. "Give me the context", "tell me more", and "Discussion" stay on that item. Give the context and roll through the most recent discussion on it. Do not drop it and do not move on.',
    'Never end a reply by handing the agenda back. Forbidden, including close paraphrases: "That\'s completely fine", "if you need any assistance", "if you want to explore something else", "if there\'s anything else you\'d like to discuss", "just let me know".',
    'If they say yes to helping someone, be glad for the person they are helping, then name the next remaining item the same way, including any token that record has. Example: "Glad you\'re helping Teo, he will appreciate it. Noor also needs someone to water the seedlings in the north tunnel today, with 40 NFC and a jar of plum jam. Can you take that on later today?" If you do not know how they are spoken of, say "they will appreciate it." A yes or a no on a decision needs no comment about the choice. Do not ask what they decided, and do not congratulate a vote. Move to the next item\'s context only. Do not invent the token. Every so often, not every turn, and only while several items remain: "Would you like to pause for now, or continue going through what still needs you?" If they pause, stop. If they continue, the next item immediately. When the list is done, say so in one line. Never vote, validate, accept, decline, or decide for them. Your words must be about the item in front of them. Do not call the tool for an item you are not talking about. The person uses the card.',
    `Person: ${personName(home.person)}.`,
    listening
      ? 'Horizon: listening to the network. After their own waiting items, you may offer one network signal below. In that reply call show_member_home_item once with its kind and slug. Name the space and why it might fit (location, interest, or experience). Offer one, not the list.'
      : 'Horizon: focused on their own spaces. Do not propose needs or opportunities from other spaces.',
    networkLines ? `Network signals:\n${networkLines}` : null,
    `Spaces (${home.counts.spaces}): ${spaces}.`,
    passedItems.length > 0
      ? `Passed. They already said no, or not now twice. Do not mention these again: ${passedItems
          .map(
            (item) => `${memberHomeThreadItemKey(item)} "${item.title ?? ''}"`,
          )
          .join('; ')}.`
      : null,
    deferredItems.length > 0
      ? `Deferred. They said not now. Do not open on these while a fresh item is waiting: ${deferredItems
          .map(
            (item) => `${memberHomeThreadItemKey(item)} "${item.title ?? ''}"`,
          )
          .join('; ')}.`
      : null,
    recall
      ? `Card on screen: kind=${recall.kind} slug=${recall.slug} title="${(
          recall.title ?? ''
        ).replace(
          /"/g,
          "'",
        )}". They said not now earlier. Ask "is this a good time?" Do not present it as a new item. Call show_member_home_item once for this card.`
      : stillWaiting[0]
      ? `Card on screen: kind=${stillWaiting[0].kind} slug=${
          stillWaiting[0].slug
        } action=${stillWaiting[0].action} title="${(
          stillWaiting[0].title ?? ''
        ).replace(
          /"/g,
          "'",
        )}". This reply is about that card only. The card already shows the title, so do not repeat it and do not announce the card. Do not name any other title.`
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
