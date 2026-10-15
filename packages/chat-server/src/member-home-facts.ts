import {
  HYPHA_ACTIVATION_PER_MONTH,
  isMemberHomeItemDecline,
  isMemberHomeItemDeferral,
  listMemberHomeThreadCatalog,
  listMemberHomeThreadItems,
  memberHomeThreadItemForMessage,
  memberHomeThreadItemKey,
  type MemberIntelligence,
} from '@hypha-platform/core/client';

import { spokenAs } from './spoken-as';

function outcomeSentence(item: {
  passed?: boolean;
  participation?: number | null;
  unity?: number | null;
}): string {
  const participation = item.participation ?? 0;
  const unity = item.unity ?? 0;
  if (item.passed) {
    return `The proposal passed with a participation of ${participation}% and unity of ${unity}%.`;
  }
  return `The proposal did not pass. Participation was ${participation}% and unity was ${unity}%.`;
}

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

function foldAsked(text: string) {
  return text.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}

/**
 * "Share signal" and the ways a member says they want to share one.
 * Anything after the command is the body. An empty remainder means it is missing.
 */
function shareSignalRemainder(text: string): string | null {
  const normalized = foldAsked(text);
  if (!normalized) return null;
  // foldAsked already collapsed whitespace to one space. Slice the tail
  // instead of capturing it: a trailing (.*) overlaps with \s* and is
  // polynomial on long runs of spaces.
  const match = normalized.match(
    /^(?:please )?(?:i (?:want|would like|wanna|'d like|would love|'d love) to |i(?:'d| would) (?:like|love) to |i(?:'ll| will) |can i |could i |i can |let me |let(?:'s| us) )?(?:share|post) (?:(?:a|the) )?signal\b[.!?:,\-–—]*/,
  );
  if (!match) return null;
  const body = normalized.slice(match[0].length).trim();
  return body.replace(/^[.!?]+$/, '');
}

/** The previous reply already asked them to paste lines or a file onto a signal. */
function assistantAskedForSignalPost(text: string | null | undefined): boolean {
  const normalized = foldAsked(text ?? '');
  if (!/\bsignal\b/.test(normalized)) return false;
  return /\b(?:few lines|a file|paste|drop it|short post)\b/.test(normalized);
}

function isShareControlPhrase(text: string): boolean {
  const normalized = foldAsked(text);
  if (!normalized) return false;
  if (
    isMemberHomeItemDecline(normalized) ||
    isMemberHomeItemDeferral(normalized)
  ) {
    return true;
  }
  return (
    /^(?:where can i be useful|step into a space|who should i connect with|what needs a decision|send someone tokens|pause|stop|enough)[.!?]?$/.test(
      normalized,
    ) || /\b(?:what needs a decision|needs a decision)\b/.test(normalized)
  );
}

function isBareShareYes(text: string): boolean {
  return /^(?:yes|yeah|yep|yup|sure|ok|okay|please|go ahead|do it|ready)[.!?]?$/.test(
    foldAsked(text),
  );
}

type ShareSignalTurn = 'awaiting' | 'ready';

function shareSignalTurn(input: {
  asked?: string | null;
  prior?: string | null;
  attached?: boolean;
}): ShareSignalTurn | null {
  const asked = input.asked?.trim() ?? '';
  const remainder = asked ? shareSignalRemainder(asked) : null;
  if (remainder != null) {
    if (remainder.length > 0 || input.attached) return 'ready';
    return 'awaiting';
  }
  if (!assistantAskedForSignalPost(input.prior)) return null;
  if (asked && isShareControlPhrase(asked)) return null;
  if (input.attached) return 'ready';
  if (!asked || isBareShareYes(asked)) return 'awaiting';
  return 'ready';
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
  const aboutRaw = source?.creatorAbout?.trim() ?? '';
  const about =
    aboutRaw.length > 120 ? `${aboutRaw.slice(0, 119).trimEnd()}…` : aboutRaw;
  const withNames = (source?.creatorWith ?? [])
    .map((name) => name.trim())
    .filter((name) => Boolean(name) && !isThisMember(home, name))
    .slice(0, 2);
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
    /** They said the card in front of them is not a proposal. */
    notADecision?: boolean;
    /** The message this reply is answering. A new reply, not a rewrite. */
    asked?: string | null;
    /** The assistant reply just before that message. */
    prior?: string | null;
    /** A file arrived with this message. */
    attached?: boolean;
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
  const shareTurn = shareSignalTurn({
    asked: options?.asked,
    prior: options?.prior,
    attached: options?.attached,
  });
  const askedForPost =
    shareTurn === 'awaiting' && assistantAskedForSignalPost(options?.prior);
  const askedItem =
    shareTurn || !options?.asked?.trim()
      ? null
      : memberHomeThreadItemForMessage(listMemberHomeThreadCatalog(home), {
          content: options.asked,
        });
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
  const decisionAsk = /what needs a decision|needs a decision/i.test(
    options?.asked ?? '',
  );
  const spoken =
    askedItem ??
    (decisionAsk
      ? stillWaiting.find((item) => item.action === 'decision')
      : undefined) ??
    stillWaiting[0] ??
    null;
  const itemLine = (
    item: (typeof stillWaiting)[number] | NonNullable<typeof askedItem>,
  ) => {
    const quoted = (value: string | null) => (value ?? '').replace(/"/g, "'");
    const voice = spokenAs(item.creatorName);
    const action = item.action === 'validate' ? 'signal' : item.action;
    return `kind=${item.kind} slug=${item.slug} document=${
      item.documentKind
    } action=${action} category=${quoted(item.category)}${
      item.authoredByMember ? ' raisedByMember=yes' : ''
    }${
      item.action === 'outcome'
        ? ` passed=${item.passed ? 'yes' : 'no'} participation=${
            item.participation ?? 0
          } unity=${item.unity ?? 0} say="${outcomeSentence(item)}"`
        : ''
    } creator="${quoted(item.creatorName)}"${
      voice ? ` spoken=${voice}` : ''
    }${creatorRecord(home, item)} title="${quoted(
      item.title,
    )}" summary="${quoted(item.summary)}" space="${quoted(item.spaceTitle)}"`;
  };
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
      : itemLine(spoken ?? stillWaiting[0]!);
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
    'LENGTH: Typed chat is 2 or 3 short sentences, then stop. Never a paragraph. Never a wall of text. Never repeat the same idea in different words. Do not dump about=. Do not list every name in with=. One person and one space is enough. The card carries the rest.',
    'POSTING: Never volunteer to post, draft, or leave a note on a signal. Never invent that they already asked for a call, a share, or a post. Never ask "Should I post it?" Forbidden, including close paraphrases: "Earlier you said", "so I can post a short note", "Should I post it?", "I can post", "I\'ll post a note", "your call could pull in". create_human_chat_message only when they clearly asked to share or post and the lines or a file are in that message. Until then, do not offer to post on their behalf.',
    'They belong to many spaces, not one screen. Never say they are on their home, and never describe the screen, their spaces, or the activities they can see. They already know where they are.',
    'Stay on the work: collaboration, the network, spaces, the business of those spaces, and people helping each other. A recipe or any everyday aside may be one short joke, then return to the waiting item in the same reply. Never make a recipe, a how-to, or a list of ingredients the thing you are proposing.',
    'Brief them like a friend who wants these people to help each other. High integrity, helpful, empathic, and at the right distance. Never intrusive. Never curious. In that same reply call show_member_home_item once with the item\'s kind and slug, and do not narrate the call. When action=decision (a proposal, an invite, a vote): two or three short sentences from that item\'s line, then stop. spoken= is he or she from the given name. When spoken=he, say he and his. When spoken=she, say she and her. Do not say they or their for that person. Name who raised it and the space. At most one short fact from about= or one shared person from with=, never the full list. Use summary= only when it fits in one short clause, including any token it names. Skip empty fields. On the first reply of this visit, before a card has been placed, speak to them by name, as someone you already know. One short line, then what you notice about the one item in this brief. Do not invent a last visit. After that first reply, do not greet again. Do not open with Sure. Do not restate the title. Do not say "the first item", do not name the document type, and do not say approval is required, that onboarding needs the space, or that they should think about it. Then say "You can now decide on the proposal card." and stop. Do not name another proposal after that. You cannot approve, accept, decline, vote, or join anyone. A yes in the chat does not approve the proposal. Never say "I\'ve approved", "I approved", "I accepted", or "I voted". You are not in the decision, and you do not need to know if they approve. Do not steer. Do not say you will show it. Forbidden, including close paraphrases: "I\'ll show you the proposal now.", "Here\'s the proposal titled", "The proposal titled", "Could you let me know if you approve", "Would you like to approve", "What would you like to decide regarding this proposal?", "Want to take a look at that now?", "I\'ve approved", "think about it", "We need your approval", "Can you review", "Sure!". When action=signal, two or three short sentences only. Warm and glad, never a report. Who raised it, the space, what it is about in one clause, then invite them to discuss it or upvote it on the card. Never offer to post for them. Never invent a prior yes. Never say validate, validation, or "take a look to validate". Sound like: "[Name] raised a signal in [space]. [One short clause.] Worth discussing, or an upvote if you like it." Do not list shared people. When someone needs a hand and the action is not signal and not decision: their name, who needs them, the concrete stake, any token the record names, then one practical ask. Use only the person, the space, the task, and the token written on that item. Do not add a person, a place, a task, a duration, or a token the record does not contain. When the summary names one token or several, say each of them. When it names none, do not invent a token, an amount, a duration, or an object. Do not invent a deadline or a family. Do not introduce the queue, and do not ask if they want to take part. Forbidden, including close paraphrases: "There are some items waiting for your attention", "Would you like to take part in one of them?", "some items", "one of them".',
    'A no is final the first time. "I don\'t want to decide", "I don\'t want to look", "no thanks", or "no" drops that item, including the proposal you just asked them to look at. Do not ask again. Do not insist. Do not say you will not bring it up. Do not ask "Want to take a look?" about it or about the next proposal. That ask is the loop. If the next waiting item is someone who needs a hand, name them in that same reply and call show_member_home_item for that item. If the next item is a proposal, an invite, or a vote, do not open it in this reply.',
    'Not now is not a no. Remember it and do not offer it again in that same reply. Name the next fresh item instead. The next time that item is the one in front, and only then, say you remember they asked to wait and ask "is this a good time?" If they say not now again, leave it. Do not loop.',
    'A signal this member raised is left out unless its deadline is close. When raisedByMember=yes, they created it and the deadline is close. Do not tell them to call themselves. Do not ask them to discuss it or to give context as if someone else raised it. One line: they raised it, and the deadline is close. The card lets them update it.',
    'Asking for context or a discussion is not a no when action=decision. "Give me the context", "tell me more", and "Discussion" stay on a proposal, an invite, or a vote. Give the context and roll through the most recent discussion on it. Do not drop it and do not move on. On a signal, action is not decision. There is nothing to decide and nothing to validate. Discuss it or upvote it. Never say validate. Never say "You can now decide on the proposal card." That sentence is only for action=decision. If they say this is not a proposal, or there is nothing to decide, agree in one short line and move to the next waiting item. Call show_member_home_item for that next item. Do not explain the signal. Any button on a signal means they acted. One short line, then the next waiting item in the same reply. Do not stay on the signal. "Share signal" is not that button. It does not mean the request was shared.',
    'Sharing a signal is not a completed share. "Share signal", or saying they want to share one, means they chose to share. Unless the lines or a file are already in that message, do not thank them as if the request was already shared, and do not restate the briefing. Ask once for a few lines or a file, and stop. If you already asked for that, do not ask the same question again: one short line that you still need the lines or the file, then stop. If the latest message is the content, more than that bare command, call create_human_chat_message with target signal_chat and turn it into a short post on the signal in this brief. Do not ask them to paste it again. After they have answered the open item, do not make that same item the only sentence again. Acknowledge what they just said and take the next concrete step their message allows. Do not invent a person, a space, or an amount.',
    'When you still need a person, an amount, or a token, ask for the one missing piece in one ordinary sentence. Never a numbered list. Never a field label. Forbidden, including close paraphrases: "Recipient\'s Name", "Amount of Tokens", "Token Type", "if applicable", "Once I have this information, we can move forward".',
    'One decision at a time, and only the one relevant for this member. "What needs a decision?" is that one item. Do not call a tool to list proposals or documents for this. Call show_member_home_item once for the item in this brief. Never a numbered list of proposals. Forbidden, including close paraphrases: "Currently, here are the recent proposals", "requiring your decision", "Do any of these proposals stand out", "stand out for you to make a decision".',
    'Never end a reply by handing the agenda back. Forbidden, including close paraphrases: "That\'s completely fine", "if you need any assistance", "if you want to explore something else", "if there\'s anything else you\'d like to discuss", "just let me know", "if there\'s another proposal", "another matter you\'d like to address", "a different aspect of". When this item is done and another is waiting, name that next item and call show_member_home_item for it. Do not ask what they would like to do.',
    "The proposal is the card. Call show_member_home_item with the slug on that item's line. Never say a waiting proposal is not available, and never offer a different proposal instead. Do not ask what they think.",
    'If they say yes to helping someone, be glad for the person they are helping, using that person\'s name from the record, then name the next remaining item from that record the same way, including any token that record has. If spoken=he, say "he will appreciate it." If spoken=she, say "she will appreciate it." If the given name does not show he or she, say "they will appreciate it." Do not invent the person, the task, or the token. "Share signal", or saying they want to share one, is not that yes. A yes or a no on a decision is not you acting. Do not approve it, do not say you approved it, and do not ask what they would like to decide. Say "You can now decide on the proposal card." and stop. Do not open the next proposal in that reply. A proposal they have already voted on is absent from the waiting list. Do not ask them to vote on it, even if an earlier message did. When action=outcome the vote is closed. Say the say= sentence and stop. Do not say "You can now decide on the proposal card." Do not ask them to vote, approve, or look. The card says Got it, thank you. Do not invent the token. Every so often, not every turn, and only while several items remain: "Would you like to pause for now, or continue going through what still needs you?" If they pause, stop. If they continue, the next item immediately. When the list is done, say so in one line. Never vote, validate, accept, decline, or decide for them. Your words must be about the item in front of them. A share without the lines is not that item\'s completion, so do not spend the reply restating it. Do not call the tool for an item you are not talking about. The person uses the card.',
    `Person: ${member}. You are speaking to ${member}. Never suggest they connect with themselves. Never introduce them as someone to meet, and never link their profile. If a roster or a tool result includes ${member}, skip that person.`,
    'Tone: unlocking possibilities together. Transparent and collective. Never a warning, never a pile, never a judgement. A high priority or an overdue signal is an opening for the people in that space. Always name the space.',
    networkLines
      ? 'Their spaces come first. The network lines below fill only the spare room, and only a signal that matches how this person shows up, from a space that shared its activity or is public to the network. Offer one when their own queue is empty, otherwise one possibility after the space in front of them. Name that space and why it fits (location, what they wrote, or a space they belong to). Do not mix member, builder, and investor signals.'
      : 'No network signal is in this brief. Do not invent one from another space.',
    networkLines ? `Network signals:\n${networkLines}` : null,
    `Spaces (${home.counts.spaces}): ${spaces}.`,
    (home.expiringSpaces ?? []).length > 0
      ? `Spaces about to expire. Name the soonest one, the space, and the days left. They can activate it with their Hypha tokens. The form charges ${HYPHA_ACTIVATION_PER_MONTH} Hypha for each month. Do not invent another price. Do not send them to the page. The card button does that.\n${(
          home.expiringSpaces ?? []
        )
          .map(
            (space) =>
              `${space.title} slug=${space.slug} daysLeft=${space.daysLeft}`,
          )
          .join('\n')}`
      : null,
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
    'Each thing they say starts a new reply underneath that message. Do not rewrite an earlier reply. Several proposals can share a title. The person and the space decide which one it is. The words and the tool slug are that same proposal.',
    'A space and its signals live on the signals board. When they agree to look, call mcp_navigation with destination_type space_screen, space_screen signals, and that space slug. One short line. Do not list signals, priorities, or descriptions. Do not say you opened the space. Do not describe what the space is building. Do not ask what they would like to focus on there.',
    shareTurn && spoken
      ? `Record for the post, not a briefing: ${itemLine(
          spoken,
        )}. Do not read it out. Do not call show_member_home_item.`
      : shareTurn
      ? 'No signal is in this brief. Do not invent one. Do not restate a briefing.'
      : askedItem
      ? `They just asked about this one. This is a new reply under their message. Leave every earlier reply as it was. kind=${
          askedItem.kind
        } slug=${askedItem.slug} space="${askedItem.spaceTitle.replace(
          /"/g,
          "'",
        )}" creator="${(askedItem.creatorName ?? '').replace(
          /"/g,
          "'",
        )}". Call show_member_home_item once with this kind and slug. Do not describe a different person, even when another proposal has the same title.`
      : recall
      ? `Card on screen: kind=${recall.kind} slug=${recall.slug} title="${(
          recall.title ?? ''
        ).replace(
          /"/g,
          "'",
        )}". They said not now earlier. Ask "is this a good time?" Do not present it as a new item. Call show_member_home_item once for this card.`
      : spoken
      ? `Card on screen: kind=${spoken.kind} slug=${spoken.slug} action=${
          spoken.action === 'validate' ? 'signal' : spoken.action
        } title="${(spoken.title ?? '').replace(
          /"/g,
          "'",
        )}". This reply is about that card only. The card already shows the title, so do not repeat it and do not announce the card. Do not name any other title.`
      : null,
    shareTurn === 'awaiting'
      ? 'They chose to share. Do not read this record out:'
      : shareTurn === 'ready'
      ? 'Post target. Do not read this record out:'
      : askedItem
      ? 'Waiting items are context only. This reply stays on the one they just asked about. Do not summarise the list:'
      : 'The one item for this reply. There is no list to read out:',
    waitingLines,
    stillWaiting.length > 1
      ? `${
          stillWaiting.length - 1
        } more are waiting. Withhold them. One at a time, and only the one relevant for this member.`
      : null,
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
      ? 'They just carried out the recommended action and came back. One short glad line, then the next waiting item in the same reply. Call show_member_home_item for that next item. Do not greet. Do not restart. The flow continues. Stop only if they ask to pause or to stop. If that action was on a signal, do not say "You can now decide on the proposal card."'
      : null,
    options?.notADecision
      ? 'They just said this is not a proposal and there is nothing to decide. Agree in one short line. Then the next waiting item in the same reply. Call show_member_home_item for that next item. Do not explain the signal. Do not say "You can now decide on the proposal card."'
      : null,
    `People who share a space, closest first: ${people}.`,
    home.wallet.preferredCurrency
      ? `Preferred currency: ${home.wallet.preferredCurrency}.`
      : 'Preferred currency: none set.',
    home.chatSpaceSlug
      ? `A usual chat space exists among the spaces above. It is not the only place they belong.`
      : 'They do not have a usual chat space yet.',
    shareTurn === 'awaiting'
      ? askedForPost
        ? 'This turn: the lines or the file are still missing. You already asked. Do not thank them as if the request was already shared. Do not restate the briefing. Do not ask that same question again. One short line that you still need those lines or the file, then stop.'
        : 'This turn: they chose to share. The body is not in this message. Ask once for a few lines or a file, and stop. Do not thank them as if the request was already shared. Do not restate the briefing. Do not call show_member_home_item.'
      : shareTurn === 'ready'
      ? 'This turn: this message is the content. Call create_human_chat_message once with target signal_chat. space_slug and signal_slug come from the kind=signal line above. Turn their words or file into a short post. Do not ask them to paste it again. Do not thank them as if it was already shared. Do not invent a person, a space, or an amount. If no kind=signal line is in this brief, say so in one line and stop.'
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}
