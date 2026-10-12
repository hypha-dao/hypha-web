import {
  listMemberHomeThreadItems,
  memberHomeThreadItemKey,
  type MemberIntelligence,
} from '@hypha-platform/core/client';

import { spokenAs } from './spoken-as';

function personName(person: {
  name: string | null;
  surname: string | null;
  nickname: string | null;
}): string {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname?.trim() || 'member';
}

function isThisMember(home: MemberIntelligence, name: string): boolean {
  const candidate = name.trim().toLowerCase();
  const member = personName(home.person).trim().toLowerCase();
  return Boolean(candidate) && candidate === member;
}

function creatorRecord(
  home: MemberIntelligence,
  item: { kind: string; slug: string | null; creatorId: number | null },
): string {
  const source =
    item.kind === 'signal'
      ? home.signals.find((row) => row.slug != null && row.slug === item.slug)
      : home.proposals.find(
          (row) => row.slug != null && row.slug === item.slug,
        );
  const about = source?.creatorAbout?.trim() ?? '';
  const withNames = (source?.creatorWith ?? [])
    .map((name) => name.trim())
    .filter((name) => Boolean(name) && !isThisMember(home, name));
  const connection =
    item.creatorId == null
      ? undefined
      : home.connections.find((person) => person.id === item.creatorId);
  const quote = (value: string) => value.replace(/"/g, "'");
  const bits: string[] = [];
  if (about) bits.push(`about="${quote(about)}"`);
  if (connection) bits.push(`shares=${connection.sharedSpaceCount}`);
  if (withNames.length > 0) {
    bits.push(`with="${withNames.map(quote).join('; ')}"`);
  }
  return bits.length > 0 ? ` ${bits.join(' ')}` : '';
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
    /** They left and did the recommended action. Do not open these again this visit. */
    acted?: readonly string[];
    /** They just came back from that action. Continue with the next item. */
    resumed?: boolean;
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
  const actedKeys = new Set(
    (options?.acted ?? []).map((key) => key.trim()).filter(Boolean),
  );
  const waiting = listMemberHomeThreadItems(home).filter(
    (item) => !(item.kind === 'signal' && networkSlugs.has(item.slug)),
  );
  const stillWaiting = waiting.filter((item) => {
    const key = memberHomeThreadItemKey(item);
    return (
      !passed.has(key) &&
      !deferredKeys.has(key) &&
      !recalledKeys.has(key) &&
      !settledKeys.has(key) &&
      !actedKeys.has(key)
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
  const networkLines =
    (home.networkSignals ?? []).length === 0
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
        : 'Nothing in their spaces needs them. No judgement. The network stays open. If a network signal is listed below, you may offer one. Otherwise invite them to activate a space. Do not imply the quiet is a problem. Do not call show_member_home_item unless you are offering that one network signal.'
      : stillWaiting
          .map((item, index) => {
            const quoted = (value: string | null) =>
              (value ?? '').replace(/"/g, "'");
            const spoken = spokenAs(item.creatorName);
            return `${index + 1}. kind=${item.kind} slug=${
              item.slug
            } document=${item.documentKind} action=${
              item.action
            } category=${quoted(item.category)} creator="${quoted(
              item.creatorName,
            )}"${spoken ? ` spoken=${spoken}` : ''}${creatorRecord(
              home,
              item,
            )} title="${quoted(item.title)}" summary="${quoted(
              item.summary,
            )}" space="${quoted(item.spaceTitle)}"`;
          })
          .join('\n');
  const recallKey = recall ? memberHomeThreadItemKey(recall) : null;
  const alreadyShown = (options?.alreadyShown ?? [])
    .map((key) => key.trim())
    .filter((key) => Boolean(key) && key !== recallKey);
  const member = personName(home.person);
  const people =
    home.connections
      .filter(
        (person) =>
          person.id !== home.person.id &&
          !isThisMember(home, personName(person)),
      )
      .map(
        (person) =>
          `${personName(person)} (shared spaces: ${person.sharedSpaceCount})`,
      )
      .join('; ') || 'none';

  return [
    'Member home facts for this signed-in person. These are records. Keep the Hypha AI voice from the instructions above. You already know this member, the spaces they belong to, and the people they share those spaces with. Accompany them. The collective is the point. Every reply ends on the next step. No open question.',
    'They belong to many spaces, not one screen. Never say they are on their home, and never describe the screen, their spaces, or the activities they can see. They already know where they are.',
    'Stay on the work: collaboration, the network, spaces, the business of those spaces, and people helping each other. A recipe or any everyday aside may be one short joke, then return to the waiting item in the same reply. Never make a recipe, a how-to, or a list of ingredients the thing you are proposing.',
    'Brief them like a friend who wants these people to help each other. High integrity, helpful, empathic, and at the right distance. Never intrusive. Never curious. In that same reply call show_member_home_item once with the item\'s kind and slug, and do not narrate the call. When action=decision (a proposal, an invite, a vote): every sentence is a fact from that item\'s line, and nothing else. Use about= for who they are. spoken= is he or she, deduced from that person\'s given name. When spoken=he, say he and his. When spoken=she, say she and her. Do not say they or their for that person. Use shares= for how many spaces they already share with this member. Use with= for the people they share a space with, and say those names — that is the connection the record has. Do not call it a chat, and do not invent a conversation, a biography, or a person. Use summary= for what is being asked, including any token it names. Use space= for where. Skip a field that is empty. On the first reply of this visit, before a card has been placed, speak to them by name, as someone you already know. One short line, then what you notice about item 1, in ordinary speech. Do not invent a last visit. After that first reply, do not greet again. Do not open with Sure. Do not restate the title. Do not say "the first item", do not name the document type, and do not say approval is required, that onboarding needs the space, or that they should think about it. Then say "You can now decide on the proposal card." and stop. Do not name another proposal after that. You cannot approve, accept, decline, vote, or join anyone. A yes in the chat does not approve the proposal. Never say "I\'ve approved", "I approved", "I accepted", or "I voted". You are not in the decision, and you do not need to know if they approve. Do not steer. Do not say you will show it. Forbidden, including close paraphrases: "I\'ll show you the proposal now.", "Here\'s the proposal titled", "The proposal titled", "Could you let me know if you approve", "Would you like to approve", "What would you like to decide regarding this proposal?", "Want to take a look at that now?", "I\'ve approved", "think about it", "We need your approval", "Can you review", "Sure!". When someone needs a hand (action is not decision): their name, who needs them, the concrete stake, any token the record names, then one practical ask. Use only the person, the space, the task, and the token written on that item. Do not add a person, a place, a task, a duration, or a token the record does not contain. When the summary names one token or several, say each of them. When it names none, do not invent a token, an amount, a duration, or an object. Do not invent a deadline or a family. Do not introduce the queue, and do not ask if they want to take part. Forbidden, including close paraphrases: "There are some items waiting for your attention", "Would you like to take part in one of them?", "some items", "one of them".',
    'A no is final the first time. "I don\'t want to decide", "I don\'t want to look", "no thanks", or "no" drops that item, including the proposal you just asked them to look at. Do not ask again. Do not insist. Do not say you will not bring it up. Do not ask "Want to take a look?" about it or about the next proposal. That ask is the loop. If the next waiting item is someone who needs a hand, name them in that same reply and call show_member_home_item for that item. If the next item is a proposal, an invite, or a vote, do not open it in this reply.',
    'Not now is not a no. Remember it and do not offer it again in that same reply. Name the next fresh item instead. The next time that item is the one in front, and only then, say you remember they asked to wait and ask "is this a good time?" If they say not now again, leave it. Do not loop.',
    'Asking for context or a discussion is not a no. "Give me the context", "tell me more", and "Discussion" stay on that item. Give the context and roll through the most recent discussion on it. Do not drop it and do not move on.',
    'Never end a reply by handing the agenda back. Forbidden, including close paraphrases: "That\'s completely fine", "if you need any assistance", "if you want to explore something else", "if there\'s anything else you\'d like to discuss", "just let me know".',
    'If they say yes to helping someone, be glad for the person they are helping, using that person\'s name from the record, then name the next remaining item from that record the same way, including any token that record has. If spoken=he, say "he will appreciate it." If spoken=she, say "she will appreciate it." If the given name does not show he or she, say "they will appreciate it." Do not invent the person, the task, or the token. A yes or a no on a decision is not you acting. Do not approve it, do not say you approved it, and do not ask what they would like to decide. Say "You can now decide on the proposal card." and stop. Do not open the next proposal in that reply. A proposal they have already voted on is absent from the waiting list. Do not ask them to vote on it, even if an earlier message did. An expired proposal is absent from the waiting list. Do not ask them to decide on it, even if an earlier message did. Do not invent the token. Every so often, not every turn, and only while several items remain: "Would you like to pause for now, or continue going through what still needs you?" If they pause, stop. If they continue, the next item immediately. When the list is done, say so in one line. Never vote, validate, accept, decline, or decide for them. Your words must be about the item in front of them. Do not call the tool for an item you are not talking about. The person uses the card.',
    `Person: ${member}. You are speaking to ${member}. Never suggest they connect with themselves. Never introduce them as someone to meet, and never link their profile. If a roster or a tool result includes ${member}, skip that person.`,
    'Tone: unlocking possibilities together. Transparent and collective. Never a warning, never a pile, never a judgement. A high priority or an overdue signal is an opening for the people in that space. Always name the space.',
    networkLines
      ? 'Their spaces come first. The network lines below fill only the spare room, and only a signal that matches how this person shows up, from a space that shared its activity or is public to the network. Offer one when their own queue is empty, otherwise one possibility after the space in front of them. Name that space and why it fits (location, what they wrote, or a space they belong to). Do not mix member, builder, and investor signals.'
      : 'No network signal is in this brief. Do not invent one from another space.',
    networkLines ? `Network signals:\n${networkLines}` : null,
    `Spaces (${home.counts.spaces}): ${spaces}.`,
    (home.movement ?? []).some(
      (item) => item.kind !== 'joined' || !isThisMember(home, item.title),
    )
      ? `Movement in their spaces. Do not lead with these. After the item in front of them, one sentence may name what else opened, with the space. Do not say someone left, or that a proposal was refused, unless a line says so:\n${(
          home.movement ?? []
        )
          .filter(
            (item) => item.kind !== 'joined' || !isThisMember(home, item.title),
          )
          .map(
            (item) =>
              `${item.kind} space="${item.spaceTitle.replace(
                /"/g,
                "'",
              )}" title="${item.title.replace(/"/g, "'")}"`,
          )
          .join('\n')}`
      : null,
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
    'Waiting items, most recent discussions first, then everything else they have not passed on. The reply is about item 1, spoken to them, not read as a file. Do not summarise the list:',
    waitingLines,
    alreadyShown.length > 0
      ? `Already placed in earlier replies. Do not call show_member_home_item for these again unless the person asks: ${alreadyShown.join(
          ', ',
        )}.`
      : 'No card has been placed in this conversation yet.',
    actedKeys.size > 0
      ? `Carried out this visit. Do not open these again unless they ask: ${[
          ...actedKeys,
        ].join(', ')}.`
      : null,
    options?.resumed
      ? 'They just carried out the recommended action and came back. One short glad line, then the next waiting item in the same reply. Call show_member_home_item for that next item. Do not greet. Do not restart. The flow continues. Stop only if they ask to pause or to stop.'
      : null,
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
