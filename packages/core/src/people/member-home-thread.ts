import type { MemberIntelligence } from './member-intelligence';
import { balanceMemberHomeThread } from './member-situation';

/** Tool the home assistant calls so a card belongs to that reply. */
export const SHOW_MEMBER_HOME_ITEM_TOOL = 'show_member_home_item';

export type MemberHomeCardKind = 'proposal' | 'signal';

/** One thing the person can act on. The card uses this same kind and slug. */
export type MemberHomeThreadItem = {
  kind: MemberHomeCardKind;
  slug: string;
  title: string;
  spaceSlug: string;
  spaceTitle: string;
  action: 'decision' | 'validate' | 'outcome';
  /**
   * What the card says it is. `proposal` and `signal` are the two actions.
   * Anything else is the document's own kind (a discussion, an agreement, a label).
   */
  documentKind: string;
  authoredByMember: boolean;
  spaceLogo?: MemberIntelligence['proposals'][number]['spaceLogo'];
  /** Signal type, or a proposal label such as Governance. */
  category: string | null;
  summary: string | null;
  creatorId: number | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  /** Database document id, used to record the vote. */
  documentId?: number | null;
  /** On-chain proposal id. Absent until the decision is published. */
  web3ProposalId?: number | null;
  /** On-chain space id for the quorum and unity targets. */
  web3SpaceId?: number | null;
  /** Closed vote. Participation is the share of voting power that voted. */
  participation?: number | null;
  /** Closed vote. Unity is the yes share of the votes cast. */
  unity?: number | null;
  /** Closed vote. True when the proposal passed. */
  passed?: boolean;
  /** Database id of the signal. Used to open its conversation. */
  signalId?: number | null;
  /** Existing Matrix room, so Discuss this does not create a second one. */
  roomId?: string | null;
  /** When the signal is due. Set only for a signal the member raised. */
  dueAt?: string | null;
};

/** A deadline inside this window, or already past, is close enough to surface. */
const DEADLINE_NEAR_MS = 7 * 24 * 60 * 60 * 1000;

export function memberHomeDeadlineNear(
  dueAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!dueAt) return false;
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return false;
  return due - now <= DEADLINE_NEAR_MS;
}

export type MemberHomeSignalCta =
  | 'help'
  | 'share'
  | 'take'
  | 'impact'
  | 'discuss'
  | 'call'
  | 'context'
  | 'later';

/** A stored "signal" is the record kind, not a category such as Need or Opportunity. */
export function memberHomeSignalCategory(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const trimmed = value?.trim() ?? '';
    if (!trimmed || trimmed.toLowerCase() === 'signal') continue;
    return trimmed;
  }
  return null;
}

/** The action that fits this signal. Insight asks for context. A need asks for a hand. */
export function memberHomeSignalAction(
  category: string | null | undefined,
): Exclude<MemberHomeSignalCta, 'later'> {
  switch ((category ?? '').trim().toLowerCase()) {
    case 'need':
      return 'help';
    case 'resource':
      return 'share';
    case 'action':
      return 'take';
    case 'impact':
      return 'impact';
    case 'opportunity':
      return 'discuss';
    case 'risk':
    case 'tension':
      return 'call';
    default:
      return 'context';
  }
}

/**
 * Primary action first, then the next human steps for this category.
 * A call is only offered when someone raised the signal.
 */
export function memberHomeSignalCtas(input: {
  category: string | null | undefined;
  hasCreator: boolean;
}): MemberHomeSignalCta[] {
  let primary = memberHomeSignalAction(input.category);
  if (primary === 'call' && !input.hasCreator) primary = 'discuss';
  const secondary: MemberHomeSignalCta[] = [];
  if (input.hasCreator && primary !== 'call') secondary.push('call');
  if (primary !== 'discuss') secondary.push('discuss');
  if (primary !== 'context') secondary.push('context');
  return [primary, ...secondary.slice(0, 2), 'later'];
}

/** Label source for the card. A vote stays a proposal. Other states keep their kind. */
export function memberHomeDocumentKind(input: {
  kind: MemberHomeCardKind;
  state?: string | null;
  label?: string | null;
}): string {
  if (input.kind === 'signal') return 'signal';
  const state = input.state?.trim().toLowerCase() ?? '';
  if (state === 'proposal') return 'proposal';
  const label = input.label?.trim();
  if (label) return label;
  if (state) return state;
  return 'proposal';
}

export function memberHomeThreadItemKey(item: {
  kind: string;
  slug: string;
}): string {
  return `${item.kind}:${item.slug}`;
}

/**
 * The queue the home chat is still walking. Cleared items leave.
 * A recalled item is back in front, so it stays.
 */
export function memberHomeItemsStillWaiting(
  items: readonly MemberHomeThreadItem[],
  closed: {
    passed?: readonly string[];
    deferred?: readonly string[];
    settled?: readonly string[];
    acted?: readonly string[];
    recalled?: readonly string[];
  },
): MemberHomeThreadItem[] {
  const hidden = new Set<string>();
  for (const key of [
    ...(closed.passed ?? []),
    ...(closed.deferred ?? []),
    ...(closed.settled ?? []),
    ...(closed.acted ?? []),
  ]) {
    const trimmed = key.trim();
    if (trimmed) hidden.add(trimmed);
  }
  for (const key of closed.recalled ?? []) {
    const trimmed = key.trim();
    if (trimmed) hidden.delete(trimmed);
  }
  return items.filter((item) => !hidden.has(memberHomeThreadItemKey(item)));
}

/**
 * Keep the rows the member is already looking at.
 * Finished items leave. New items arrive at the top, in the order given.
 */
export function mergeMemberHomeAttention(
  previous: readonly MemberHomeThreadItem[],
  next: readonly MemberHomeThreadItem[],
): MemberHomeThreadItem[] {
  const incoming = new Map(
    next.map((item) => [memberHomeThreadItemKey(item), item] as const),
  );
  const kept = previous.flatMap((item) => {
    const key = memberHomeThreadItemKey(item);
    const fresh = incoming.get(key);
    if (!fresh) return [];
    incoming.delete(key);
    return [fresh];
  });
  return [...incoming.values(), ...kept];
}

/** "{Alex Prate} joined" is the member arriving, not something that needs them. */
export function isMemberOwnJoinTitle(
  person: MemberIntelligence['person'],
  title: string,
): boolean {
  const value = title.trim().toLowerCase();
  if (!value) return false;
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  const labels = [full, person.nickname?.trim() ?? ''].filter(Boolean);
  return labels.some((label) => value === `${label.toLowerCase()} joined`);
}

/**
 * What the home assistant should bring into the conversation.
 * Notifications lead, then any other open decision or assigned signal.
 * The same slug is never listed twice.
 */
function collectMemberHomeThreadItems(
  home: MemberIntelligence,
): MemberHomeThreadItem[] {
  const proposalsBySlug = new Map(
    home.proposals.flatMap((proposal) =>
      proposal.slug ? [[proposal.slug, proposal] as const] : [],
    ),
  );
  const signalsBySlug = new Map(
    home.signals.flatMap((signal) =>
      signal.slug ? [[signal.slug, signal] as const] : [],
    ),
  );
  const items: MemberHomeThreadItem[] = [];
  const seen = new Set<string>();
  const logosBySlug = new Map<
    string,
    NonNullable<MemberHomeThreadItem['spaceLogo']>
  >();
  const rememberLogo = (
    slug: string,
    logo: MemberHomeThreadItem['spaceLogo'],
  ) => {
    if (!slug || !logo) return;
    if (
      !logo.logoUrl &&
      !logo.ecosystemLogoUrlLight &&
      !logo.ecosystemLogoUrlDark
    ) {
      return;
    }
    logosBySlug.set(slug, logo);
  };
  for (const space of home.spaces) {
    rememberLogo(space.slug, {
      logoUrl: space.logoUrl,
      ecosystemLogoUrlLight: space.ecosystemLogoUrlLight ?? null,
      ecosystemLogoUrlDark: space.ecosystemLogoUrlDark ?? null,
    });
  }
  for (const proposal of home.proposals) {
    rememberLogo(proposal.spaceSlug, proposal.spaceLogo);
  }
  for (const signal of home.signals) {
    rememberLogo(signal.spaceSlug, signal.spaceLogo);
  }
  for (const note of [...home.attention, ...home.notifications]) {
    rememberLogo(note.spaceSlug, note.spaceLogo);
  }

  const push = (item: MemberHomeThreadItem) => {
    const slug = item.slug.trim();
    if (!slug || isMemberOwnJoinTitle(home.person, item.title)) return;
    const key = memberHomeThreadItemKey({ ...item, slug });
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      ...item,
      slug,
      spaceLogo: item.spaceLogo ?? logosBySlug.get(item.spaceSlug) ?? null,
    });
  };

  const pushOutcome = (
    proposal: MemberIntelligence['proposals'][number] | null | undefined,
  ) => {
    if (!proposal?.slug || !proposal.expired || !proposal.outcome) return false;
    push({
      kind: 'proposal',
      slug: proposal.slug,
      title: proposal.title,
      spaceSlug: proposal.spaceSlug,
      spaceTitle: proposal.spaceTitle,
      action: 'outcome',
      documentKind: memberHomeDocumentKind({
        kind: 'proposal',
        state: proposal.state,
        label: proposal.label,
      }),
      authoredByMember: proposal.authoredByMember,
      category: proposal.label,
      summary: proposal.description,
      creatorId: proposal.creatorId,
      creatorName: proposal.creatorName,
      creatorAvatarUrl: proposal.creatorAvatarUrl,
      documentId: proposal.id,
      web3ProposalId: proposal.web3ProposalId,
      web3SpaceId: proposal.web3SpaceId ?? null,
      participation: proposal.outcome.participation,
      unity: proposal.outcome.unity,
      passed: proposal.outcome.passed,
    });
    return true;
  };

  const pushProposal = (proposal: MemberIntelligence['proposals'][number]) => {
    if (pushOutcome(proposal)) return;
    if (!proposal.slug || !proposalStillOpen(proposal)) return;
    push({
      kind: 'proposal',
      slug: proposal.slug,
      title: proposal.title,
      spaceSlug: proposal.spaceSlug,
      spaceTitle: proposal.spaceTitle,
      action: 'decision',
      documentKind: memberHomeDocumentKind({
        kind: 'proposal',
        state: proposal.state,
        label: proposal.label,
      }),
      authoredByMember: proposal.authoredByMember,
      category: proposal.label,
      summary: proposal.description,
      creatorId: proposal.creatorId,
      creatorName: proposal.creatorName,
      creatorAvatarUrl: proposal.creatorAvatarUrl,
      documentId: proposal.id,
      web3ProposalId: proposal.web3ProposalId,
      web3SpaceId: proposal.web3SpaceId ?? null,
    });
  };

  for (const proposal of home.proposals) {
    if (proposal.state?.trim().toLowerCase() !== 'discussion') continue;
    pushProposal(proposal);
  }

  const notes = home.attention.length > 0 ? home.attention : home.notifications;
  for (const note of notes) {
    if (note.kind === 'proposal') {
      const proposal = proposalsBySlug.get(note.targetSlug);
      if (pushOutcome(proposal)) continue;
      if (!proposalStillOpen(proposal)) continue;
      push({
        kind: 'proposal',
        slug: note.targetSlug,
        title: proposal?.title ?? note.title,
        spaceSlug: proposal?.spaceSlug ?? note.spaceSlug,
        spaceTitle: proposal?.spaceTitle ?? note.spaceTitle,
        action: 'decision',
        documentKind: memberHomeDocumentKind({
          kind: 'proposal',
          state: proposal?.state,
          label: proposal?.label,
        }),
        authoredByMember: proposal?.authoredByMember ?? false,
        category: proposal?.label ?? note.category ?? null,
        summary: proposal?.description ?? note.summary ?? null,
        creatorId: proposal?.creatorId ?? note.creatorId ?? null,
        creatorName: proposal?.creatorName ?? note.creatorName ?? null,
        creatorAvatarUrl:
          proposal?.creatorAvatarUrl ?? note.creatorAvatarUrl ?? null,
        documentId: proposal?.id ?? null,
        web3ProposalId: proposal?.web3ProposalId ?? null,
        web3SpaceId: proposal?.web3SpaceId ?? null,
      });
      continue;
    }
    const signal = signalsBySlug.get(note.targetSlug);
    const creatorId = signal?.creatorId ?? note.creatorId ?? null;
    const dueAt = signal?.dueAt ?? null;
    if (raisedByMember(home, creatorId) && !memberHomeDeadlineNear(dueAt)) {
      continue;
    }
    push({
      kind: 'signal',
      slug: note.targetSlug,
      title: signal?.title ?? note.title,
      spaceSlug: signal?.spaceSlug ?? note.spaceSlug,
      spaceTitle: signal?.spaceTitle ?? note.spaceTitle,
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: raisedByMember(home, creatorId),
      category: memberHomeSignalCategory(signal?.type, note.category),
      summary: signal?.description ?? note.summary ?? null,
      dueAt,
      creatorId,
      creatorName: signal?.creatorName ?? note.creatorName ?? null,
      creatorAvatarUrl:
        signal?.creatorAvatarUrl ?? note.creatorAvatarUrl ?? null,
      ...(typeof signal?.id === 'number' ? { signalId: signal.id } : {}),
      ...(signal?.roomId?.trim() ? { roomId: signal.roomId.trim() } : {}),
    });
  }

  for (const proposal of home.proposals) {
    pushProposal(proposal);
  }

  for (const signal of home.signals) {
    if (!signal.slug) continue;
    if (
      raisedByMember(home, signal.creatorId) &&
      !memberHomeDeadlineNear(signal.dueAt)
    ) {
      continue;
    }
    push({
      kind: 'signal',
      slug: signal.slug,
      title: signal.title,
      spaceSlug: signal.spaceSlug,
      spaceTitle: signal.spaceTitle,
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: raisedByMember(home, signal.creatorId),
      category: memberHomeSignalCategory(signal.type),
      summary: signal.description,
      dueAt: signal.dueAt ?? null,
      creatorId: signal.creatorId,
      creatorName: signal.creatorName,
      creatorAvatarUrl: signal.creatorAvatarUrl,
      signalId: signal.id,
      ...(signal.roomId?.trim() ? { roomId: signal.roomId.trim() } : {}),
    });
  }

  for (const signal of home.networkSignals ?? []) {
    if (!signal.slug) continue;
    if (raisedByMember(home, signal.creatorId)) continue;
    push({
      kind: 'signal',
      slug: signal.slug,
      title: signal.title,
      spaceSlug: signal.spaceSlug,
      spaceTitle: signal.spaceTitle,
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: false,
      spaceLogo: signal.spaceLogo,
      category: memberHomeSignalCategory(signal.type),
      summary: signal.description,
      creatorId: signal.creatorId,
      creatorName: signal.creatorName,
      creatorAvatarUrl: signal.creatorAvatarUrl,
    });
  }

  return items;
}

/** What the home assistant walks. One kind cannot fill the conversation. */
export function listMemberHomeThreadItems(
  home: MemberIntelligence,
): MemberHomeThreadItem[] {
  return balanceMemberHomeThread(collectMemberHomeThreadItems(home), home);
}

/** Every open item, including ones the balanced walk has not reached yet. */
export function listMemberHomeThreadCatalog(
  home: MemberIntelligence,
): MemberHomeThreadItem[] {
  return collectMemberHomeThreadItems(home);
}

function attentionAt(home: MemberIntelligence, item: MemberHomeThreadItem) {
  if (item.kind === 'proposal') {
    return (
      home.proposals.find((proposal) => proposal.slug === item.slug)
        ?.createdAt ?? ''
    );
  }
  return (
    home.signals.find((signal) => signal.slug === item.slug)?.createdAt ??
    item.dueAt ??
    ''
  );
}

/**
 * Everything still needing the member, newest first.
 * The chat keeps a shorter walk. This list is the Attention needed tile.
 */
export function listMemberHomeAttentionItems(
  home: MemberIntelligence,
): MemberHomeThreadItem[] {
  const network = new Set(
    (home.networkSignals ?? []).flatMap((signal) =>
      signal.slug ? [signal.slug] : [],
    ),
  );
  return collectMemberHomeThreadItems(home)
    .filter((item) => !(item.kind === 'signal' && network.has(item.slug)))
    .sort((left, right) => {
      const leftAt = attentionAt(home, left);
      const rightAt = attentionAt(home, right);
      if (leftAt !== rightAt) return leftAt < rightAt ? 1 : -1;
      return left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0;
    });
}

/**
 * A discussion is still a conversation. A proposal is a decision only while
 * it has a chain vote that has not closed and this member has not voted.
 * An agreement, or a proposal row with no chain id, has nothing left to decide.
 */
function proposalStillOpen(
  proposal: MemberIntelligence['proposals'][number] | null | undefined,
): proposal is MemberIntelligence['proposals'][number] {
  if (!proposal?.slug || proposal.memberHasVoted || proposal.expired) {
    return false;
  }
  const state = proposal.state?.trim().toLowerCase();
  if (state === 'discussion') return true;
  if (state !== 'proposal') return false;
  return proposal.web3ProposalId != null;
}

function raisedByMember(
  home: MemberIntelligence,
  creatorId: number | null | undefined,
) {
  return creatorId != null && creatorId === home.person.id;
}

function textFromParts(parts: readonly unknown[] | undefined): string {
  if (!parts) return '';
  return parts
    .flatMap((part) => {
      if (!part || typeof part !== 'object') return [];
      const record = part as { type?: unknown; text?: unknown };
      if (record.type !== 'text' || typeof record.text !== 'string') return [];
      return [record.text];
    })
    .join('\n')
    .trim();
}

function toolInputs(parts: readonly unknown[] | undefined): unknown[] {
  if (!parts) return [];
  const inputs: unknown[] = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const record = part as {
      type?: unknown;
      toolName?: unknown;
      state?: unknown;
      input?: unknown;
      args?: unknown;
      output?: unknown;
    };
    const type = typeof record.type === 'string' ? record.type : '';
    const named =
      type === `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}` ||
      (type === 'dynamic-tool' &&
        record.toolName === SHOW_MEMBER_HOME_ITEM_TOOL);
    if (!named) continue;
    if (record.state === 'input-streaming') continue;
    const payload = record.input ?? record.args ?? record.output;
    if (payload == null) continue;
    inputs.push(payload);
  }
  return inputs;
}

function itemFromToolInput(
  items: readonly MemberHomeThreadItem[],
  input: unknown,
): MemberHomeThreadItem | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as { kind?: unknown; slug?: unknown };
  if (record.kind !== 'proposal' && record.kind !== 'signal') return null;
  if (typeof record.slug !== 'string') return null;
  const slug = record.slug.trim();
  if (!slug) return null;
  return (
    items.find((item) => item.kind === record.kind && item.slug === slug) ??
    null
  );
}

function itemsReferencedInText(
  items: readonly MemberHomeThreadItem[],
  text: string,
): MemberHomeThreadItem[] {
  const haystack = text.trim().toLowerCase();
  if (!haystack) return [];
  const hits: { index: number; item: MemberHomeThreadItem }[] = [];
  for (const item of items) {
    const title = item.title.trim().toLowerCase();
    const space = item.spaceTitle.trim().toLowerCase();
    const indexes = [title, space]
      .filter((value) => value.length >= 3)
      .map((value) => haystack.indexOf(value))
      .filter((index) => index >= 0);
    if (indexes.length === 0) continue;
    hits.push({ index: Math.min(...indexes), item });
  }
  hits.sort((left, right) => left.index - right.index);
  const seen = new Set<string>();
  const ordered: MemberHomeThreadItem[] = [];
  for (const hit of hits) {
    const key = memberHomeThreadItemKey(hit.item);
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(hit.item);
  }
  return ordered;
}

function creatorTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function creatorNamedInText(name: string | null, haystack: string): boolean {
  const tokens = creatorTokens(name ?? '');
  if (tokens.length === 0) return false;
  const distinctive = tokens.filter((token) => token.length >= 4);
  const required = distinctive.length > 0 ? distinctive : tokens;
  return required.every((token) => haystack.includes(token));
}

function textOverlap(item: MemberHomeThreadItem, haystack: string): number {
  return creatorTokens(`${item.title} ${item.summary ?? ''}`).filter((token) =>
    haystack.includes(token),
  ).length;
}

const HOME_BOARD_YES =
  /^(yes|yeah|yep|yup|sure|ok|okay|please|go ahead|open it|take me there|yes please|do it)[.!]?$/i;

const HOME_BOARD_OFFER =
  /\b(signals board|signal board|navigate(?: you)? to|check in with|open the)\b/i;

function homeBoardSpace(
  text: string,
  spaces: readonly { slug: string; title: string }[],
) {
  const haystack = text.toLowerCase();
  const hits = spaces.flatMap((space) => {
    const title = space.title.trim().toLowerCase();
    if (title.length < 3) return [];
    const index = haystack.indexOf(title);
    if (index < 0) return [];
    return [{ space, index, length: title.length }];
  });
  hits.sort(
    (left, right) => right.length - left.length || right.index - left.index,
  );
  return hits[0]?.space ?? null;
}

function homeBoardHref(lang: string, slug: string) {
  const locale = lang.trim().split('-')[0]?.toLowerCase() || 'en';
  return `/${locale}/dho/${slug}/coherence`;
}

/**
 * A yes to visiting a space opens its signals board.
 * A yes on a proposal stays on the card.
 */
export function memberHomeBoardDestination(args: {
  text: string;
  previousAssistantText: string;
  spaces: readonly { slug: string; title: string }[];
  lang: string;
}): { href: string; title: string } | null {
  const asked = args.text.trim();
  const direct = homeBoardSpace(asked, args.spaces);
  if (
    direct &&
    asked.length <= 180 &&
    /\b(signals board|signal board|signals|navigate|open|take me|go to)\b/i.test(
      asked,
    )
  ) {
    return { href: homeBoardHref(args.lang, direct.slug), title: direct.title };
  }
  if (!HOME_BOARD_YES.test(asked)) return null;
  const prior = args.previousAssistantText.trim();
  if (!HOME_BOARD_OFFER.test(prior)) return null;
  const offered = homeBoardSpace(prior, args.spaces);
  if (!offered) return null;
  return {
    href: homeBoardHref(args.lang, offered.slug),
    title: offered.title,
  };
}

/** Three "1. " style items, scanned without a backtracking pattern. */
function hasNumberedCatalogue(text: string) {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 48 || code > 57) continue;
    if (index > 0) {
      const previous = text.charCodeAt(index - 1);
      if (previous >= 48 && previous <= 57) continue;
    }
    let end = index;
    while (end < text.length && end - index < 6) {
      const digit = text.charCodeAt(end);
      if (digit < 48 || digit > 57) break;
      end += 1;
    }
    if (text[end] === '.' && text[end + 1] === ' ') {
      count += 1;
      if (count >= 3) return true;
      index = end;
    }
  }
  return false;
}

/** A reply that recites a space's signals instead of opening the board. */
export function memberHomeSignalCatalogue(
  text: string,
  spaces: readonly { slug: string; title: string }[],
  lang: string,
): { href: string; title: string } | null {
  const catalogue =
    /\b(i['’]ve opened|i have opened|here are some recent signals|recent signals)\b/i.test(
      text,
    ) || hasNumberedCatalogue(text);
  if (!catalogue) return null;
  const space = homeBoardSpace(text, spaces);
  if (!space) return null;
  return { href: homeBoardHref(lang, space.slug), title: space.title };
}

function spaceNamedInText(item: MemberHomeThreadItem, haystack: string) {
  const space = item.spaceTitle.trim().toLowerCase();
  return space.length >= 3 && haystack.includes(space);
}

/** The words name this proposal, not another one that shares its title. */
function textBelongsTo(item: MemberHomeThreadItem, text: string): boolean {
  const haystack = text.trim().toLowerCase();
  if (!haystack) return false;
  if (creatorNamedInText(item.creatorName, haystack)) return true;
  const title = item.title.trim().toLowerCase();
  return (
    title.length >= 3 &&
    haystack.includes(title) &&
    spaceNamedInText(item, haystack)
  );
}

function itemMentionedInText(
  items: readonly MemberHomeThreadItem[],
  text: string,
): MemberHomeThreadItem | null {
  const haystack = text.trim().toLowerCase();
  if (!haystack) return null;
  const matches = items.filter((item) => {
    const title = item.title.trim().toLowerCase();
    return title.length >= 3 && haystack.includes(title);
  });
  if (matches.length > 1) {
    const narrowed = matches.filter(
      (item) =>
        creatorNamedInText(item.creatorName, haystack) ||
        spaceNamedInText(item, haystack),
    );
    const byPersonAndSpace = narrowed.filter(
      (item) =>
        creatorNamedInText(item.creatorName, haystack) &&
        spaceNamedInText(item, haystack),
    );
    if (byPersonAndSpace.length === 1 && byPersonAndSpace[0]) {
      return byPersonAndSpace[0];
    }
    if (narrowed.length === 1 && narrowed[0]) return narrowed[0];
  }
  if (matches.length === 1 && matches[0]) return matches[0];
  const talkingAboutProposal = /\b(proposal|invite|vote|contribution)\b/.test(
    haystack,
  );
  const pool = talkingAboutProposal
    ? items.filter((item) => item.kind === 'proposal')
    : items;
  const byCreator = pool.filter((item) =>
    creatorNamedInText(item.creatorName, haystack),
  );
  if (byCreator.length === 1 && byCreator[0]) return byCreator[0];
  if (byCreator.length > 1) {
    const ranked = [...byCreator].sort(
      (left, right) =>
        textOverlap(right, haystack) - textOverlap(left, haystack),
    );
    return ranked[0] ?? null;
  }
  const referenced = itemsReferencedInText(items, text);
  const referencedProposals = referenced.filter(
    (item) => item.kind === 'proposal',
  );
  if (
    talkingAboutProposal &&
    referenced.length === 1 &&
    referencedProposals.length === 1 &&
    referencedProposals[0]
  ) {
    return referencedProposals[0];
  }
  if (
    talkingAboutProposal &&
    /\b(proposal card|in front of you)\b/.test(haystack) &&
    pool[0]
  ) {
    return pool[0];
  }
  return null;
}

/**
 * The card for this assistant reply.
 * A `show_member_home_item` call wins, unless the words name a different
 * person and space. Two proposals can share a title. A greeting names none.
 */
export function memberHomeThreadItemForMessage(
  items: readonly MemberHomeThreadItem[],
  message: { parts?: readonly unknown[]; content?: string },
): MemberHomeThreadItem | null {
  const text = textFromParts(message.parts) || message.content?.trim() || '';
  const mentioned = itemMentionedInText(items, text);
  let toolItem: MemberHomeThreadItem | null = null;
  for (const input of toolInputs(message.parts)) {
    const item = itemFromToolInput(items, input);
    if (!item) continue;
    toolItem = item;
    break;
  }
  if (
    mentioned &&
    toolItem &&
    memberHomeThreadItemKey(mentioned) !== memberHomeThreadItemKey(toolItem) &&
    textBelongsTo(mentioned, text) &&
    !textBelongsTo(toolItem, text)
  ) {
    return mentioned;
  }
  if (toolItem) return toolItem;
  return mentioned;
}

function memberHomeChoiceText(text: string) {
  return text.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}

/**
 * "Not now" keeps the item. The next time it comes up, ask if it is a good time.
 * A pause of the whole conversation is not a deferral of one item.
 */
export function isMemberHomeItemDeferral(text: string): boolean {
  const normalized = memberHomeChoiceText(text);
  if (!normalized) return false;
  if (
    /\b(pause for now|let's pause|lets pause|stop for now|enough for now)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  return (
    /^(later|another time)[.!]?$/.test(normalized) ||
    /\b(not now|nicht jetzt|ahora no|pas maintenant|agora não|agora nao|nu niet|ikke nå|ikke na|не сега|another time|not a good time)\b/.test(
      normalized,
    )
  );
}

/**
 * A reply that drops the item just offered.
 * "I don't want to decide on it" counts. "Not now" does not. A pause does not.
 */
export function isMemberHomeItemDecline(text: string): boolean {
  const normalized = memberHomeChoiceText(text);
  if (!normalized || isMemberHomeItemDeferral(normalized)) return false;
  const asksForContext =
    /\b(tell me more|more about|more context|give me the context|context on|help me think|most recent discussion)\b/.test(
      normalized,
    );
  const hardNo =
    /^(no|nope|nah|skip|pass)[.!]?$/.test(normalized) ||
    /\b(no thanks|no thank you|not interested|nein danke|no, gracias|non merci|não, obrigado|nao, obrigado|nee, bedankt|nei takk|не, благодарам|skip it|skip this|pass on this|not this one|not that one)\b/.test(
      normalized,
    ) ||
    /\b(don't|do not|didn't|did not|won't|will not)\b.{0,60}\b(want|decide|decision|look|vote|weigh)\b/.test(
      normalized,
    );
  if (asksForContext && !hardNo) return false;
  if (
    /\b(pause for now|let's pause|lets pause|stop for now|enough for now)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  return hardNo;
}

export type MemberHomeItemMemory = {
  /** A no, or not now twice. Do not raise these again. */
  passed: string[];
  /** A single "not now", not yet brought back in this transcript. */
  deferred: string[];
  /** Brought back once already. Do not ask again in this conversation. */
  recalled: string[];
  /** They answered the bring-back. Do not ask again. */
  settled: string[];
  /** Items this transcript already talked about. Transcript state wins over stored memory. */
  mentioned: string[];
  /** Deferred by the latest user message. Do not bring it back in this reply. */
  held: string | null;
};

type MemberHomeMemoryMessage = {
  role?: string;
  parts?: readonly unknown[];
  content?: string;
};

/**
 * What the member already chose, read from the conversation.
 * One "not now" waits. A second "not now", or a no, leaves the item.
 */
export function memberHomeItemMemory(
  items: readonly MemberHomeThreadItem[],
  messages: ReadonlyArray<MemberHomeMemoryMessage>,
): MemberHomeItemMemory {
  const declines = new Map<string, number>();
  const defers = new Map<string, number>();
  const recalls = new Map<string, number>();
  const settled = new Set<string>();
  const mentioned = new Set<string>();
  let currentKey: string | null = null;
  let assistantText = '';
  let held: string | null = null;

  for (const message of messages) {
    if (message.role === 'assistant') {
      assistantText =
        textFromParts(message.parts) || message.content?.trim() || '';
      const item = memberHomeThreadItemForMessage(items, message);
      if (!item) continue;
      const key = memberHomeThreadItemKey(item);
      mentioned.add(key);
      const deferredCount = defers.get(key) ?? 0;
      const recallCount = recalls.get(key) ?? 0;
      if ((declines.get(key) ?? 0) === 0 && deferredCount > recallCount) {
        recalls.set(key, recallCount + 1);
      }
      currentKey = key;
      continue;
    }
    if (message.role !== 'user' || !currentKey) continue;
    const text = textFromParts(message.parts) || message.content?.trim() || '';
    const normalized = memberHomeChoiceText(text);
    // Only the latest user message holds an item. A later reply can bring it back.
    held = null;
    if (isMemberHomeItemDeferral(text)) {
      defers.set(currentKey, (defers.get(currentKey) ?? 0) + 1);
      held = currentKey;
      continue;
    }
    if (isMemberHomeItemDecline(text)) {
      const named = itemsReferencedInText(items, text);
      const offered = itemsReferencedInText(items, assistantText);
      const targets =
        named.length > 0
          ? named
          : offered.length > 0
          ? [offered[offered.length - 1]!]
          : [];
      if (targets.length === 0) {
        declines.set(currentKey, (declines.get(currentKey) ?? 0) + 1);
      }
      for (const target of targets) {
        const key = memberHomeThreadItemKey(target);
        declines.set(key, (declines.get(key) ?? 0) + 1);
      }
      continue;
    }
    const deferredCount = defers.get(currentKey) ?? 0;
    const recallCount = recalls.get(currentKey) ?? 0;
    const asksForContext =
      /\b(tell me more|more about|more context|give me the context|context on|help me think|most recent discussion)\b/.test(
        normalized,
      );
    const pauses =
      /\b(pause for now|let's pause|lets pause|stop for now|enough for now)\b/.test(
        normalized,
      );
    if (deferredCount > 0 && recallCount > 0 && !asksForContext && !pauses) {
      settled.add(currentKey);
    }
  }

  const passed: string[] = [];
  const deferred: string[] = [];
  const recalled: string[] = [];
  const settledKeys: string[] = [];
  for (const item of items) {
    const key = memberHomeThreadItemKey(item);
    const declined = (declines.get(key) ?? 0) > 0;
    const deferredCount = defers.get(key) ?? 0;
    const recallCount = recalls.get(key) ?? 0;
    if (declined || deferredCount >= 2) {
      passed.push(key);
      continue;
    }
    if (settled.has(key)) {
      settledKeys.push(key);
      continue;
    }
    if (deferredCount === 1 && recallCount === 0) {
      deferred.push(key);
      continue;
    }
    if (deferredCount === 1 && recallCount > 0) {
      recalled.push(key);
    }
  }

  return {
    passed,
    deferred,
    recalled,
    settled: settledKeys,
    mentioned: [...mentioned],
    held,
  };
}

/** Stored choices from an earlier visit, with this transcript winning where they overlap. */
export function mergeMemberHomeMemory(
  fromMessages: MemberHomeItemMemory,
  remembered?: {
    passed?: readonly string[];
    deferred?: readonly string[];
    settled?: readonly string[];
  },
): { passed: string[]; deferred: string[]; settled: string[] } {
  const mentioned = new Set(fromMessages.mentioned);
  const unique = (keys: string[]) =>
    keys.filter((key, index, all) => all.indexOf(key) === index);
  const settled = unique([
    ...(remembered?.settled ?? []).filter(
      (key) => key.trim() && !mentioned.has(key),
    ),
    ...fromMessages.settled,
  ]);
  const settledSet = new Set(settled);
  const passed = unique([
    ...(remembered?.passed ?? []).filter(
      (key) => key.trim() && !mentioned.has(key) && !settledSet.has(key),
    ),
    ...fromMessages.passed,
  ]).filter((key) => !settledSet.has(key));
  const passedSet = new Set(passed);
  const deferred = unique([
    ...(remembered?.deferred ?? []).filter(
      (key) =>
        key.trim() &&
        !mentioned.has(key) &&
        !passedSet.has(key) &&
        !settledSet.has(key),
    ),
    ...fromMessages.deferred,
  ]).filter((key) => !passedSet.has(key) && !settledSet.has(key));
  return { passed, deferred, settled };
}

/**
 * Items the member already refused.
 * The offer is the last assistant reply that named one item. The next user
 * refusal drops it, so a later turn cannot put it back at the front.
 */
export function passedMemberHomeItemKeys(
  items: readonly MemberHomeThreadItem[],
  messages: ReadonlyArray<MemberHomeMemoryMessage>,
): string[] {
  return memberHomeItemMemory(items, messages).passed;
}

/** Items already placed on earlier assistant replies. */
export function shownMemberHomeItemKeys(
  items: readonly MemberHomeThreadItem[],
  messages: ReadonlyArray<{
    role?: string;
    parts?: readonly unknown[];
    content?: string;
  }>,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const item = memberHomeThreadItemForMessage(items, message);
    if (!item) continue;
    const key = memberHomeThreadItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}
