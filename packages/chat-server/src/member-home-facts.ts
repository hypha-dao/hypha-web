import {
  HYPHA_ACTIVATION_PER_MONTH,
  isMemberHomeItemDecline,
  isMemberHomeItemDeferral,
  isMemberHomeItemLook,
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
    return `It passed — ${participation}% participation, with ${unity}% unity.`;
  }
  return `It didn't pass this time. ${participation}% participation, with ${unity}% unity.`;
}

function personName(person: {
  name: string | null;
  surname: string | null;
  nickname: string | null;
}): string {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname?.trim() || 'member';
}

function givenName(person: {
  name: string | null;
  nickname: string | null;
}): string {
  const given = person.name?.trim().split(/\s+/)[0];
  if (given) return given;
  const nick = person.nickname?.trim().split(/\s+/)[0];
  return nick || 'friend';
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

function foldChip(text: string) {
  let chip = foldAsked(text);
  while (chip.startsWith('¿') || chip.startsWith('¡')) {
    chip = chip.slice(1);
  }
  while (chip.endsWith('.') || chip.endsWith('!') || chip.endsWith('?')) {
    chip = chip.slice(0, -1);
  }
  return chip.trim();
}

/** Chips that already put a list on screen. The reply must not open another item. */
export function memberHomeListAsk(
  text: string | null | undefined,
): 'people' | 'spaces' | 'tokens' | null {
  const chip = foldChip(text ?? '');
  if (!chip) return null;
  const people = new Set([
    'who is around',
    "who's around",
    'who are around',
    'who should i connect with',
    'quién está cerca',
    'qui est là',
    'quem está por perto',
    'wer ist da',
    'wie is er in de buurt',
    'hvem er i nærheten',
    'кој е во близина',
  ]);
  const spaces = new Set([
    'step into a space',
    'entrar en un espacio',
    'entrer dans un espace',
    'entrar num espaço',
    'einen space betreten',
    'stap een space binnen',
    'gå inn i et rom',
    'влези во простор',
  ]);
  const tokens = new Set([
    'send someone tokens',
    'enviar tokens a alguien',
    'envoyer des tokens à quelqu’un',
    "envoyer des tokens à quelqu'un",
    'enviar tokens a alguém',
    'jemandem token senden',
    'iemand tokens sturen',
    'send tokens til noen',
    'испрати токени на некого',
  ]);
  if (people.has(chip)) return 'people';
  if (spaces.has(chip)) return 'spaces';
  if (tokens.has(chip)) return 'tokens';
  return null;
}

function listTurnLine(kind: 'people' | 'spaces' | 'tokens') {
  if (kind === 'people') {
    return 'This turn: they asked who is around. The people list is already on screen above your reply, online first. One short warm sentence in the same voice as "Where can I be useful?" — like a friend opening the circle, not a UI caption. Invite them toward chat or call. Never say above, below, listed, tap, or screen. Do not rank anyone by shared spaces. Do not invent who is online. Do not call any tool. Do not write a function call, XML, DSML, a slug, or a parameter. Do not mention a signal, a proposal, or a decision.';
  }
  if (kind === 'spaces') {
    return 'This turn: they asked to step into a space. The space list is already on screen above your reply. One short warm sentence in the same voice as "Where can I be useful?" — like a friend opening the door, not a UI caption. Invite them to step in. Never say above, below, listed, tap, or screen. Do not name a space. Do not suggest they leave one space for another. Do not call any tool. Do not write a function call, XML, DSML, a slug, or a parameter. Do not open a signal or a proposal.';
  }
  return 'This turn: they asked to send tokens. The send form is already on screen above your reply. One short warm sentence in the same voice as "Where can I be useful?" — like a friend offering to help send, not a UI caption. Ask who they would like to send to. Never say above, below, listed, tap, or screen. Do not name a closest person. Do not rank anyone by shared spaces. Do not call any tool. Do not write a function call, XML, DSML, a slug, or a parameter. Do not open a signal or a proposal.';
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
  if (memberHomeListAsk(normalized)) return true;
  return (
    /^(?:where can i be useful|step into a space|who should i connect with|who is around|what needs a decision|send someone tokens|pause|stop|enough|continue with what still needs me)[.!?]?$/.test(
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
  item: {
    kind: string;
    slug: string | null;
    creatorId: number | null;
    authoredByMember?: boolean;
  },
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
  // Own signal/proposal: peers in the space are not co-raisers. Listing them
  // as with= made the model invent "Edgar's thread" for a signal this member raised.
  if (!item.authoredByMember && withNames.length > 0) {
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
): { text: string; card: { kind: string; slug: string } | null } {
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
  const isStillOpen = (
    item: ReturnType<typeof listMemberHomeThreadCatalog>[number],
  ) => {
    const key = memberHomeThreadItemKey(item);
    return (
      !passed.has(key) &&
      !deferredKeys.has(key) &&
      !recalledKeys.has(key) &&
      !settledKeys.has(key) &&
      !actedKeys.has(key)
    );
  };
  const inOwnSpaces = (
    item: ReturnType<typeof listMemberHomeThreadCatalog>[number],
  ) => !(item.kind === 'signal' && networkSlugs.has(item.slug));
  // Chat walks a short focus first. When that is done, keep going from the
  // full attention catalog so "nothing needs you" cannot fire while the
  // Attention panel still has open items.
  const focusWaiting = listMemberHomeThreadItems(home).filter(inOwnSpaces);
  const catalogWaiting = listMemberHomeThreadCatalog(home).filter(inOwnSpaces);
  const focusOpen = focusWaiting.filter(isStillOpen);
  const catalogOpen = catalogWaiting.filter(isStillOpen);
  const stillWaiting =
    focusOpen.length > 0 ? focusOpen : catalogOpen.slice(0, 8);
  const waiting = focusWaiting.length > 0 ? focusWaiting : catalogWaiting;
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
  const listAsk = memberHomeListAsk(options?.asked);
  const shareTurn = shareSignalTurn({
    asked: options?.asked,
    prior: options?.prior,
    attached: options?.attached,
  });
  const askedForPost =
    shareTurn === 'awaiting' && assistantAskedForSignalPost(options?.prior);
  // "Continue with the next" quotes the item they just finished. That
  // title must not become the card for the reply that introduces the next one.
  const continueAsk =
    /carried out the recommended action/i.test(options?.asked ?? '') ||
    /continue with what still needs me/i.test(options?.asked ?? '');
  const usefulAsk =
    !listAsk &&
    /^(?:where can i be useful|i am on my home)[.!?]?$/i.test(
      foldChip(options?.asked ?? ''),
    );
  // "Not now for Fiat Balance" names the item in order to set it aside.
  // Treating that name as the card puts the same card under the reply.
  const settingAside = Boolean(
    options?.asked?.trim() &&
      (isMemberHomeItemDeferral(options.asked) ||
        isMemberHomeItemDecline(options.asked)),
  );
  const askedItem =
    shareTurn ||
    continueAsk ||
    usefulAsk ||
    settingAside ||
    !options?.asked?.trim()
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
  const shownKeys = new Set(
    (options?.alreadyShown ?? []).map((key) => key.trim()).filter(Boolean),
  );
  // Prefer an item that is not in the thread yet. When every waiting item
  // was already placed, keep the first one so the reply still has a card.
  const unspoken = stillWaiting.filter(
    (item) => !shownKeys.has(memberHomeThreadItemKey(item)),
  );
  const lookAsk = Boolean(
    !continueAsk &&
      !settingAside &&
      options?.asked?.trim() &&
      isMemberHomeItemLook(options.asked),
  );
  const namedAside =
    settingAside && options?.asked
      ? memberHomeThreadItemForMessage(listMemberHomeThreadCatalog(home), {
          content: options.asked,
        })
      : null;
  const asideKey =
    options?.held?.trim() ||
    (namedAside ? memberHomeThreadItemKey(namedAside) : '');
  const stillOpen = (item: { kind: string; slug: string }) =>
    !asideKey || memberHomeThreadItemKey(item) !== asideKey;
  // A new waiting item comes first. When every one was already placed, a
  // normal follow-up still carries that card — except a continue/return ask,
  // which must not re-brief the same item in a loop.
  const spoken =
    (askedItem && stillOpen(askedItem) ? askedItem : null) ??
    (decisionAsk
      ? unspoken.find(
          (item) => item.action === 'decision' && stillOpen(item),
        ) ??
        stillWaiting.find(
          (item) => item.action === 'decision' && stillOpen(item),
        )
      : undefined) ??
    unspoken.find(stillOpen) ??
    (!shareTurn && !lookAsk && !continueAsk && !usefulAsk
      ? stillWaiting.find(stillOpen) ?? null
      : null);
  const looked = lookAsk
    ? memberHomeThreadItemForMessage(listMemberHomeThreadCatalog(home), {
        content: options?.prior ?? '',
      })
    : null;
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
        ? lookAsk && recalledItems[0]
          ? `They asked to see this card. It is under this reply: kind=${
              recalledItems[0].kind
            } slug=${recalledItems[0].slug} title="${(
              recalledItems[0].title ?? ''
            ).replace(/"/g, "'")}" space="${recalledItems[0].spaceTitle.replace(
              /"/g,
              "'",
            )}". One short line naming the title and the space. Do not say the space is open. Do not say they can vote right there. Do not say you opened it. Call show_member_home_item once.`
          : 'Already asked once if this is a good time. Do not ask again in this conversation. If they just agreed, be glad and name the next item. If nothing else is waiting, say so in one line. Do not present the item as new.'
        : passedItems.length > 0
        ? 'Nothing left in the queue. They already passed on the items below. Say that in one line. Do not ask what else they would like, and do not bring a passed item back.'
        : 'Nothing in their spaces needs them. No judgement. The network stays open. If a network signal is listed below, you may offer one. Otherwise invite them to activate a space. Do not imply the quiet is a problem. Do not call show_member_home_item unless you are offering that one network signal.'
      : lookAsk
      ? looked
        ? `They asked to see the card from the reply just above. ${itemLine(
            looked,
          )} One short line naming the title and the space. Do not introduce a different person. Do not open the next waiting item.`
        : 'They asked to see the card from the reply just above. One short line that it is that same item. Do not introduce a different person. Do not open the next waiting item.'
      : settingAside && !spoken
      ? 'They just set that one aside. One line that you will leave it for another time. Do not call show_member_home_item. Do not place that card under this reply.'
      : continueAsk && !spoken
      ? 'They asked to continue. Every waiting item was already placed in earlier replies. One short line that you already covered what is open for now. Do not place the same card again. Do not invent a new person or item. Do not call show_member_home_item.'
      : usefulAsk && !spoken
      ? 'They asked where they can be useful. Nothing fresh is waiting that has not already been placed. One short line that nothing needs them right now. Do not place a card. Do not invent a person or item. Do not call show_member_home_item. Do not rank people by shared spaces.'
      : spoken
      ? itemLine(spoken)
      : 'This turn is not a card. Do not call show_member_home_item.';
  const recallKey = recall ? memberHomeThreadItemKey(recall) : null;
  const alreadyShown = (options?.alreadyShown ?? [])
    .map((key) => key.trim())
    .filter((key) => Boolean(key) && key !== recallKey);
  const member = personName(home.person);

  const text = [
    listAsk ? listTurnLine(listAsk) : null,
    usefulAsk
      ? 'This turn: they asked where they can be useful. Brief ONLY the one waiting item in this brief. Three or four short sentences about that one person and that one need, then stop. Call show_member_home_item once for that card. One item. One card. Forbidden, including close paraphrases: ranking people by shared spaces, "keeps showing up across the most spaces", bundling a roster person with a signal, offering to navigate to signals, inventing collaboration details not on the item line, a second topic. Do not use the connections roster for this reply.'
      : null,
    'Member home facts for this signed-in person. These are records. Keep the Hypha AI voice from the instructions above. You already know this member, the spaces they belong to, and the people they share those spaces with. Accompany them. The collective is the point. Everyone here can be helpful. No open question about what they feel like doing. One gentle opening about this item is enough. Never a command.',
    'LENGTH: Typed chat and spoken voice are the same script: three or four short sentences, like a friend catching them up, then stop. Every sentence ends with a full stop. Never stop in the middle of a sentence, and never end on a dash or a colon. Never a paragraph. Never a wall of text. Never a second topic, another space, or a separate upvote nudge. Never repeat the same idea in different words. Never say the same sentence twice. Do not dump about=. Do not list every name in with=. One person and one space is enough. The detail is already on screen, so do not describe an interface.',
    'INTRODUCE: You are a friend in this community, catching them up on one person who is asking for attention. Talk about the people, never the interface. Never say card, screen, or button. Never say "You can now decide on the proposal card." Address the member by first name. Speak to them by name. The person who raised it is the subject, in the active voice, by first name (the first word of creator=). Sound like care, not a task. Observation, what the community needs, then one gentle opening. Use only facts on that item\'s line. creator= and space= on one line belong together — never put a person from one line into another line\'s space. Example shapes below are shapes only: never copy their names (Suzana, Kuan, Ronnie, Marieke, Flywheel, Energy) onto a real item. Do not add a person, a number, a place, or a reason that is not written on that line. spoken= is he or she. When spoken=he, say he and his. When spoken=she, say she and her.',
    'BINDING: The words and show_member_home_item are one fact. kind=, slug=, creator=, space=, title=, summary=, and action= on the Card for this reply line are the only truth. If action=decision or action=outcome and category=invite (or title is Invite Member), this is an invite proposal in that space — never call it a signal, never invent a collaboration, a produce run, another space, or a signals board. If kind=signal, do not call it an invite or a vote. Never move creator= into a space= that is not on that same line. Never brief a different waiting item under this card.',
    'WHERE WE LEFT OFF: If a previous reply is named below, continue that conversation. One clause that picks the thread up, using their first name only if you have not just used it, then this item. Do not greet again. Do not invent a visit, a feeling, or a promise that reply did not already say. If this is the first thing you say this visit, greet them by first name as someone you already know. Do not invent where you left off.',
    'VOICE: Warm, easy, and glad to be with them. Nonviolent: say what you notice, what the people need, and one opening they can accept or leave. Empathic, never urgent. Collective: this is a community where everyone can help. Never lead with a command. Forbidden, including close paraphrases: "Want to vote", "There\'s still time to vote", "Can you review", "Take a look", "You need to".',
    'Invite still open (title, category, or summary is someone asking to join or become a member, and action=decision): their first name has asked to join that space. The people who already belong there are who can welcome them. Example shape, not a script to copy: "Alex, Kuan has asked to join Hypha Flywheel. The people there would feel it if you sat with that. Only if it feels right."',
    'Proposal still open (action=decision, not an invite): their first name owns it. One concrete clause from summary= or title=, as something the community is holding together. Example shape, not a script to copy: "Alex, Ronnie has been sitting with the studio costs in Hypha Energy. The people there would be glad of your voice, whenever it feels right."',
    'Proposal passed (action=outcome and passed=yes): it just passed. What it covers, from summary=, in one clause, then participation=% and unity=% from the record. Example shape: "Alex\'s expenses proposal just passed. It covers the IT costs, with 62% participation and 80% unity." When say= is present, that sentence states the outcome. Keep its percents.',
    'Proposal failed (action=outcome and passed=no): it did not pass. Say what the numbers show. Low participation means it did not carry. Low unity means unity was weak. Use the percents on the line. Do not invent a quorum figure that is not written there. Example shape, not a script to copy: "Ronnie\'s proposal to fund the studio didn\'t pass. Participation stayed at 18%, and unity was weak."',
    'Signal that is a need, or someone needing a hand: their first name could use the community, on the concrete thing, in that space. Example shape, not a script to copy: "Alex, Marieke in the energy hub could use a hand with the first interviews. It would mean a lot if you had a moment."',
    'Signal that is a tension: their first name is naming something the community can hold, and what it is about. Example shape, not a script to copy: "Alex, Suzana is naming a tension about how decisions land. She would feel met if you stayed with it for a moment."',
    'Any other signal: still their first name as the subject, the space, and one clause of what it is about. Warm and specific. Never say validate. Never offer to post unless they asked to share.',
    'POSTING: Never volunteer to post, draft, or leave a note on a signal. Never invent that they already asked for a call, a share, or a post. Never ask "Should I post it?" Forbidden, including close paraphrases: "Earlier you said", "so I can post a short note", "Should I post it?", "I can post", "I\'ll post a note", "your call could pull in". create_human_chat_message only when they clearly asked to share or post and the lines or a file are in that message. Until then, do not offer to post on their behalf.',
    'QUEUE: Never say that nothing needs them while any waiting item remains in this brief. Declining a post offer, or dropping a note idea, is not the end of the queue. Name the next waiting item instead.',
    'They belong to many spaces, not one screen. Never say they are on their home, and never describe the screen, their spaces, or the activities they can see. They already know where they are.',
    'Stay on the work: collaboration, the network, spaces, the business of those spaces, and people helping each other. A recipe or any everyday aside may be one short joke, then return to the waiting item in the same reply. Never make a recipe, a how-to, or a list of ingredients the thing you are proposing.',
    'Brief them like a friend who wants these people to help each other. High integrity, helpful, empathic, and at the right distance. Never intrusive. Never curious. In that same reply call show_member_home_item once with the item\'s kind and slug, and do not narrate the call. When action=decision (a proposal, an invite, or a vote): three or four short sentences, like a friend, then stop. spoken= is he or she from the given name. When spoken=he, say he and his. When spoken=she, say she and her. Do not say they or their for that person. Name who raised it and the space. At most one short fact from about= or one shared person from with=, never the full list. Use summary= only when it fits in one short clause, including any token it names. Skip empty fields. On the first reply of this visit, greet them by first name, as a friend in the community, then what you notice about the one item. Do not invent a last visit. After that first reply, pick up where you left off and do not greet again. Do not open with Sure. Do not read a title out as a label. Fold what it is about into the sentence. Do not say "the first item", do not say document or record, and do not say approval is required, that onboarding needs the space, or that they should think about it. Follow INTRODUCE for the wording, then stop. Never say "You can now decide on the proposal card." Do not name another proposal after that. You cannot approve, accept, decline, vote, or join anyone. A yes in the chat does not approve the proposal. Never say "I\'ve approved", "I approved", "I accepted", or "I voted". You are not in the decision, and you do not need to know if they approve. Do not steer. Do not say you will show it. Forbidden, including close paraphrases: "I\'ll show you the proposal now.", "Here\'s the proposal titled", "The proposal titled", "Could you let me know if you approve", "Would you like to approve", "What would you like to decide regarding this proposal?", "Want to take a look at that now?", "I\'ve approved", "think about it", "We need your approval", "Can you review", "Sure!". When action=signal, three or four short sentences. Warm and glad, never a report. Who raised it, the space, and what it is about, held as something the community can meet. Never mention a card. Never offer to post for them. Never invent a prior yes. Never say validate, validation, or "take a look to validate". Follow INTRODUCE for a signal. Do not say upvote on a card. Do not list shared people. When someone needs a hand and the action is not signal and not decision: their name, who needs them, the concrete stake, any token the record names, then one practical ask. Use only the person, the space, the task, and the token written on that item. Do not add a person, a place, a task, a duration, or a token the record does not contain. When the summary names one token or several, say each of them. When it names none, do not invent a token, an amount, a duration, or an object. Do not invent a deadline or a family. Do not introduce the queue, and do not ask if they want to take part. Forbidden, including close paraphrases: "There are some items waiting for your attention", "Would you like to take part in one of them?", "some items", "one of them".',
    'A no is final the first time. "I don\'t want to decide", "I don\'t want to look", "no thanks", or "no" drops that item, including the proposal you just asked them to look at. Do not ask again. Do not insist. Do not say you will not bring it up. Do not ask "Want to take a look?" about it or about the next proposal. That ask is the loop. If the next waiting item is someone who needs a hand, name them in that same reply and call show_member_home_item for that item. If the next item is a proposal, an invite, or a vote, do not name it in this reply.',
    'Not now is not a no. Remember it and do not offer it again in that same reply. Name the next fresh item instead. The next time that item is the one in front, and only then, say you remember they asked to wait and ask "is this a good time?" If they say not now again, leave it. Do not loop.',
    'A signal this member raised is left out unless its deadline is close. When raisedByMember=yes, THIS MEMBER created it and the deadline is close. Say they raised it / you raised it / your signal — never another person\'s name as the author. Do not say "Edgar\'s thread" or "X has put something on the table" for an item they raised. Do not invent a raiser from a space roster. Do not ask them to discuss it as if someone else raised it. One or two lines: they raised it, the deadline is close, what it is about from title=/summary=. The card lets them update it.',
    'Asking for context or a discussion is not a no when action=decision. "Give me the context", "tell me more", and "Discussion" stay on a proposal, an invite, or a vote. Give the context and roll through the most recent discussion on it. Do not drop it and do not move on. On a signal, action is not decision. There is nothing to decide and nothing to validate. Discuss it or upvote it. Never say validate. Never say "You can now decide on the proposal card." That sentence is never right. Follow INTRODUCE. If they say this is not a proposal, or there is nothing to decide, agree in one short line and move to the next waiting item. Call show_member_home_item for that next item. Do not explain the signal. Any button on a signal means they acted. One short line, then the next waiting item in the same reply. Do not stay on the signal. "Share signal" is not that button. It does not mean the request was shared.',
    'Sharing a signal is not a completed share. "Share signal", or saying they want to share one, means they chose to share. Unless the lines or a file are already in that message, do not thank them as if the request was already shared, and do not restate the briefing. Ask once for a few lines or a file, and stop. If you already asked for that, do not ask the same question again: one short line that you still need the lines or the file, then stop. If the latest message is the content, more than that bare command, call create_human_chat_message with target signal_chat and turn it into a short post on the signal in this brief. Do not ask them to paste it again. After they have answered the open item, do not make that same item the only sentence again. Acknowledge what they just said and take the next concrete step their message allows. Do not invent a person, a space, or an amount.',
    'When you still need a person, an amount, or a token, ask for the one missing piece in one ordinary sentence. Never a numbered list. Never a field label. Forbidden, including close paraphrases: "Recipient\'s Name", "Amount of Tokens", "Token Type", "if applicable", "Once I have this information, we can move forward".',
    'One decision at a time, and only the one relevant for this member. "What needs a decision?" is that one item. Do not call a tool to list proposals or documents for this. Call show_member_home_item once for the item in this brief. Never a numbered list of proposals. Forbidden, including close paraphrases: "Currently, here are the recent proposals", "requiring your decision", "Do any of these proposals stand out", "stand out for you to make a decision".',
    'Never end a reply by handing the agenda back. Forbidden, including close paraphrases: "That\'s completely fine", "if you need any assistance", "if you want to explore something else", "if there\'s anything else you\'d like to discuss", "just let me know", "if there\'s another proposal", "another matter you\'d like to address", "a different aspect of". When this item is done and another is waiting, name that next item and call show_member_home_item for it. Do not ask what they would like to do.',
    "Call show_member_home_item with the slug on that item's line. The words introduce that same slug — same creator=, same space=. Never name one person and call the tool for another item. Never say a waiting proposal is not available, and never offer a different proposal instead. Do not ask what they think.",
    'If they say yes to helping someone, be glad for the person they are helping, using that person\'s name from the record, then name the next remaining item from that record the same way, including any token that record has. If spoken=he, say "he will appreciate it." If spoken=she, say "she will appreciate it." If the given name does not show he or she, say "they will appreciate it." Do not invent the person, the task, or the token. "Share signal", or saying they want to share one, is not that yes. A yes or a no on a decision is not you acting. Do not approve it, do not say you approved it, and do not ask what they would like to decide. Never say "You can now decide on the proposal card." The introduction and show_member_home_item for that same item are one reply. Do not name a second proposal. A proposal they have already voted on is absent from the waiting list. Do not ask them to vote on it, even if an earlier message did. When action=outcome the vote is closed. Use passed, participation, and unity exactly as written. When say= is present, keep that sentence and its percents. Stop. Do not say "You can now decide on the proposal card." Do not ask them to vote, approve, or look. The card says Got it, thank you. Do not invent the token. Every so often, not every turn, and only while several items remain: "Would you like to pause for now, or continue going through what still needs you?" If they pause, stop. If they continue, the next item immediately. When the list is done, say so in one line. Never vote, validate, accept, decline, or decide for them. Your words must be about the item in front of them. A share without the lines is not that item\'s completion, so do not spend the reply restating it. Do not call the tool for an item you are not talking about. The person uses the card.',
    options?.prior?.trim() && !listAsk && !shareTurn
      ? `Where you left off. Your previous reply was: "${options.prior
          .trim()
          .replace(/"/g, "'")
          .slice(
            0,
            500,
          )}". Continue that conversation. One short clause that picks the thread up, then this item. Do not greet again. Do not invent a visit.`
      : !listAsk && !shareTurn
      ? 'This is the first thing you say this visit. Greet them by first name. Do not invent where you left off.'
      : null,
    `Person: ${member}. First name: ${givenName(
      home.person,
    )}. You are speaking to ${givenName(
      home.person,
    )}. Address them as ${givenName(
      home.person,
    )}. Never suggest they connect with themselves. Never introduce them as someone to meet, and never link their profile. If a roster or a tool result includes ${member}, skip that person.`,
    'Tone: unlocking possibilities together. Transparent and collective. Never a warning, never a pile, never a judgement. A high priority or an overdue signal is an opening for the people in that space. Always name the space.',
    networkLines
      ? 'Their spaces come first. The network lines below fill only the spare room, and only a signal that matches how this person shows up, from a space that shared its activity or is public to the network. Offer one when their own queue is empty, otherwise one possibility after the space in front of them. Name that space and why it fits (location, what they wrote, or a space they belong to). Do not mix member, builder, and investor signals.'
      : 'No network signal is in this brief. Do not invent one from another space.',
    networkLines ? `Network signals:\n${networkLines}` : null,
    `They belong to ${home.counts.spaces} spaces. That is a count, not a place they are standing. Do not name a space unless space= on the item in this brief names it. Do not suggest they leave one space for another.`,
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
      ? `Movement in their spaces. Do not lead with these. Do not add a movement sentence when the reply already has a greeting and an item — that breaks LENGTH. Only name movement when the waiting queue is empty, in one short sentence with the space. Do not say someone left, or that a proposal was refused, unless a line says so:\n${(
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
    'A space and its signals live on the signals board. When they agree to look, call mcp_navigation with destination_type space_screen, space_screen signals, and that space slug. One short line. Do not list signals, priorities, or descriptions. Do not say you opened the space. Do not say the space is open. Do not say the card is right there. The card is under this reply only when this brief names it. Do not describe what the space is building. Do not ask what they would like to focus on there.',
    listAsk
      ? null
      : shareTurn && spoken
      ? `Record for the post, not a briefing: ${itemLine(
          spoken,
        )}. Do not read it out. Do not call show_member_home_item.`
      : shareTurn
      ? 'No signal is in this brief. Do not invent one. Do not restate a briefing.'
      : lookAsk
      ? looked
        ? `They asked to see the card from the reply just above. This is not the next item. kind=${
            looked.kind
          } slug=${looked.slug} title="${(looked.title ?? '').replace(
            /"/g,
            "'",
          )}" space="${looked.spaceTitle.replace(
            /"/g,
            "'",
          )}". One short line naming the title and the space. Do not introduce a different person. Call show_member_home_item once for this card.`
        : 'They asked to see the card from the reply just above. One short line that it is that same item. Do not introduce a different person. Do not call show_member_home_item for a different item.'
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
      ? `Card for this reply: kind=${recall.kind} slug=${recall.slug} title="${(
          recall.title ?? ''
        ).replace(
          /"/g,
          "'",
        )}". They said not now earlier. Ask "is this a good time?" Do not present it as a new item. Call show_member_home_item once for this card.`
      : spoken
      ? `Card for this reply: kind=${spoken.kind} slug=${spoken.slug} action=${
          spoken.action === 'validate' ? 'signal' : spoken.action
        } title="${(spoken.title ?? '').replace(
          /"/g,
          "'",
        )}". This reply is about that content only. Introduce it in three or four short sentences about the person. Never make the whole reply a title and a space. Do not announce an interface. Do not name any other title.`
      : lookAsk && recalledItems[0]
      ? `Card for this reply: kind=${recalledItems[0].kind} slug=${
          recalledItems[0].slug
        } title="${(recalledItems[0].title ?? '').replace(
          /"/g,
          "'",
        )}". They asked to see it. One short line naming the title and the space. Do not say the space is open. Do not say they can vote right there. Do not say you opened it. Call show_member_home_item once.`
      : null,
    listAsk
      ? listTurnLine(listAsk)
      : shareTurn === 'awaiting'
      ? 'They chose to share. Do not read this record out:'
      : shareTurn === 'ready'
      ? 'Post target. Do not read this record out:'
      : askedItem
      ? 'Waiting items are context only. This reply stays on the one they just asked about. Do not summarise the list:'
      : 'The one item for this reply. There is no list to read out:',
    listAsk ? null : waitingLines,
    !listAsk && !lookAsk && stillWaiting.length > 1
      ? `${
          stillWaiting.length - 1
        } more are waiting. Withhold them. One at a time, and only the one relevant for this member.`
      : null,
    listAsk
      ? null
      : alreadyShown.length > 0
      ? `Already placed in earlier replies: ${alreadyShown.join(
          ', ',
        )}. Do not pretend an item in this list is new. Prefer one that is not in this list when it is still waiting. This reply still has the card named above. Call show_member_home_item once for that card.`
      : 'No card has been placed in this conversation yet.',
    actedKeys.size > 0
      ? `Carried out this visit. Do not open these again unless they ask: ${[
          ...actedKeys,
        ].join(', ')}.`
      : null,
    options?.resumed
      ? 'They just carried out the recommended action and came back. One short glad line, then the next waiting item in the same reply. Call show_member_home_item for that next item. Do not greet. Do not restart. The flow continues. Stop only if they ask to pause or to stop. If that action was on a signal, do not say "You can now decide on the proposal card."'
      : /continue with what still needs me/i.test(options?.asked ?? '')
      ? 'They opened home and the talk is still going. The next item is the one in this brief. Three or four short sentences about the person, then stop. Do not greet again. Do not restate a title already placed. Never make the whole reply a title and a space. Keep going. Stop only if they ask to stop, or they accept a pause you offered.'
      : null,
    options?.notADecision
      ? 'They just said this is not a proposal and there is nothing to decide. Agree in one short line. Then the next waiting item in the same reply. Call show_member_home_item for that next item. Do not explain the signal. Do not say "You can now decide on the proposal card."'
      : null,
    // Roster naming made the model invent "closest person" dumps on tokens
    // and useful/decision briefings. The send widget already lists people.
    null,
    home.wallet.preferredCurrency
      ? `Preferred currency: ${home.wallet.preferredCurrency}.`
      : 'Preferred currency: none set.',
    settingAside && spoken
      ? 'They just set one item aside. One short line that you will leave it, then only the card in this brief. Call show_member_home_item for that card, not the one they set aside.'
      : settingAside
      ? 'They just set that one aside. One line that you will leave it for another time. Do not call show_member_home_item. Do not place that card under this reply.'
      : null,
    null,
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
  const broughtBack = settingAside
    ? spoken
    : lookAsk
    ? looked ?? recalledItems[0] ?? null
    : askedItem ?? spoken ?? recall ?? recalledItems[0] ?? null;
  const card =
    listAsk == null && broughtBack?.slug && shareTurn == null
      ? { kind: broughtBack.kind, slug: broughtBack.slug }
      : null;
  return { text, card };
}

function quoteFact(value: string | null | undefined) {
  return (value ?? '').replace(/"/g, "'");
}

function networkFit(reasons: readonly string[]) {
  const words = reasons.flatMap((reason) => {
    if (reason === 'location') return ['near where they are'];
    if (reason === 'interest') return ['close to what they care about'];
    if (reason === 'experience') return ['close to work they already do'];
    return [];
  });
  return words.join('; ') || 'shared with the network';
}

/**
 * Left network panel. One opportunity outside the member's own spaces.
 * Home keeps the personal queue.
 */
export function formatNetworkOutlookFacts(
  home: MemberIntelligence,
  options?: {
    alreadyShown?: readonly string[];
    passed?: readonly string[];
    deferred?: readonly string[];
    settled?: readonly string[];
    acted?: readonly string[];
    asked?: string | null;
  },
): { text: string; card: { kind: string; slug: string } | null } {
  const bySlug = new Map(
    (home.networkSignals ?? []).flatMap((signal) =>
      signal.slug ? [[signal.slug, signal] as const] : [],
    ),
  );
  const closed = new Set(
    [
      ...(options?.alreadyShown ?? []),
      ...(options?.passed ?? []),
      ...(options?.deferred ?? []),
      ...(options?.settled ?? []),
      ...(options?.acted ?? []),
    ]
      .map((key) => key.trim())
      .filter(Boolean),
  );
  const open = listMemberHomeThreadCatalog(home).filter((item) => {
    if (item.kind !== 'signal' || !item.slug || !bySlug.has(item.slug)) {
      return false;
    }
    return !closed.has(memberHomeThreadItemKey(item));
  });
  const asked = options?.asked?.trim()
    ? memberHomeThreadItemForMessage(open, { content: options.asked })
    : null;
  const chosen = asked ?? open[0] ?? null;
  const signal = chosen?.slug ? bySlug.get(chosen.slug) : undefined;
  const first = givenName(home.person);
  const line =
    signal && chosen
      ? `kind=signal slug=${
          signal.slug ?? ''
        } reasons=${signal.relevance.reasons.join(',')} fit="${quoteFact(
          networkFit(signal.relevance.reasons),
        )}" title="${quoteFact(signal.title)}" summary="${quoteFact(
          signal.description,
        )}" space="${quoteFact(signal.spaceTitle)}" creator="${quoteFact(
          signal.creatorName,
        )}"`
      : null;
  const text = [
    'Network outlook for this signed-in member. This is not their home. Home already covers decisions, people, and activity in the spaces they belong to. Here the subject is one opportunity on the wider network that fits them.',
    'LENGTH: three or four short sentences, then stop. Every sentence ends with a full stop. Never stop in the middle of a sentence. Never a list. Never a second opportunity.',
    'Say who raised it, by the first name in creator=, the space, and why it fits. fit= is the reason, in ordinary words. Use only facts on the opportunity line. Do not invent a person, a space, a need, or a reason.',
    'Do not ask where they can be useful in their own spaces. Do not ask who is around them. Do not ask what needs their decision. Do not describe their home.',
    `Person: ${personName(
      home.person,
    )}. First name: ${first}. Address them as ${first}.`,
    line
      ? `Opportunity for this reply. Call show_member_home_item once with this kind and slug. Do not name another:\n${line}`
      : 'No opportunity on the network fits them right now. One sentence that nothing is open to join. Do not open a proposal or a signal from their own spaces. Do not call show_member_home_item. Do not comment on making something up.',
    line && open.length > 1
      ? `${
          open.length - 1
        } more opportunities fit them. Withhold them. One at a time.`
      : null,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join('\n');
  return {
    text,
    card: chosen?.slug ? { kind: chosen.kind, slug: chosen.slug } : null,
  };
}
