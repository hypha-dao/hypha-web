import type { MemberIntelligence } from './member-intelligence';
import {
  balanceMemberHomeThread,
  memberHomeSignalProgressIsClosed,
} from './member-situation';

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
    if (memberHomeSignalProgressIsClosed(signal?.progressStatus)) continue;
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
    if (memberHomeSignalProgressIsClosed(signal.progressStatus)) continue;
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
    .filter(
      (item) =>
        item.action !== 'outcome' &&
        !(item.kind === 'signal' && network.has(item.slug)),
    )
    .sort((left, right) => {
      const leftAt = attentionAt(home, left);
      const rightAt = attentionAt(home, right);
      if (leftAt !== rightAt) return leftAt < rightAt ? 1 : -1;
      return left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0;
    });
}

/**
 * Lead for the space dashboard "Needs you" tile: only an open vote or signal
 * in that space. Accepted / rejected outcomes and done / archived signals are
 * not waiting — the section hides when the queue is empty.
 */
export function listSpaceAttentionLead(
  home: MemberIntelligence,
  spaceSlug: string,
  turn = 0,
): MemberHomeThreadItem | null {
  const waiting = listMemberHomeThreadCatalog(home).filter(
    (item) =>
      item.spaceSlug === spaceSlug &&
      (item.action === 'decision' || item.action === 'validate'),
  );
  if (waiting.length === 0) return null;
  const index = ((turn % waiting.length) + waiting.length) % waiting.length;
  return waiting[index] ?? null;
}

/**
 * A discussion is still a conversation. A proposal is a decision only while
 * it has a chain vote that has not closed, has not been withdrawn, and this
 * member has not voted. An agreement, or a proposal row with no chain id, has
 * nothing left to decide.
 */
function proposalStillOpen(
  proposal: MemberIntelligence['proposals'][number] | null | undefined,
): proposal is MemberIntelligence['proposals'][number] {
  if (
    !proposal?.slug ||
    proposal.memberHasVoted ||
    proposal.expired ||
    proposal.withdrawn
  ) {
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
    for (const payload of [record.output, record.input, record.args]) {
      if (payload != null) inputs.push(payload);
    }
  }
  return inputs;
}

/**
 * The waiting item this tool call means.
 * The model often passes the title instead of the slug. One match is enough.
 */
export function resolveMemberHomeThreadItem(
  items: readonly MemberHomeThreadItem[],
  input: { kind?: unknown; slug?: unknown },
): MemberHomeThreadItem | null {
  if (input.kind !== 'proposal' && input.kind !== 'signal') return null;
  if (typeof input.slug !== 'string') return null;
  const slug = input.slug.trim();
  if (!slug) return null;
  const sameKind = items.filter((item) => item.kind === input.kind);
  const exact = sameKind.find((item) => item.slug === slug);
  if (exact) return exact;
  const folded = foldHomeText(slug);
  const byFoldedSlug = sameKind.find(
    (item) => foldHomeText(item.slug) === folded,
  );
  if (byFoldedSlug) return byFoldedSlug;
  const byTitle = sameKind.filter(
    (item) =>
      foldHomeText(item.title) === folded || titleNamedInText(item.title, slug),
  );
  if (byTitle.length === 1) return byTitle[0] ?? null;
  return null;
}

function itemFromToolInput(
  items: readonly MemberHomeThreadItem[],
  input: unknown,
): MemberHomeThreadItem | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as { kind?: unknown; slug?: unknown };
  return resolveMemberHomeThreadItem(items, record);
}

function itemsReferencedInText(
  items: readonly MemberHomeThreadItem[],
  text: string,
): MemberHomeThreadItem[] {
  const haystack = foldHomeText(text);
  if (!haystack) return [];
  const hits: { index: number; item: MemberHomeThreadItem }[] = [];
  for (const item of items) {
    const title = foldHomeText(item.title);
    const space = foldHomeText(item.spaceTitle);
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

/** Dashes, accents, and Turkish dotless i fold so a title still matches the reply. */
function foldHomeText(value: string): string {
  return value
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTitleTokens(title: string): string[] {
  return foldHomeText(title)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 || /^\d{4}$/.test(token));
}

function titleNamedInText(title: string, haystack: string): boolean {
  const foldedTitle = foldHomeText(title);
  const foldedHaystack = foldHomeText(haystack);
  if (foldedTitle.length >= 3 && foldedHaystack.includes(foldedTitle)) {
    return true;
  }
  const tokens = significantTitleTokens(title);
  if (tokens.length < 2) return false;
  return tokens.every((token) => foldedHaystack.includes(token));
}

function creatorTokens(name: string): string[] {
  return foldHomeText(name)
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

/** "Marieke's candidate review" names Marieke without the rest of the name. */
function givenNameInText(name: string | null, haystack: string): boolean {
  const given = creatorTokens(name ?? '')[0];
  if (!given || given.length < 4) return false;
  return haystack.includes(given);
}

/**
 * ", Alex." at the end of a sentence is address, not authorship.
 * "Edgar's thread …, Alex." must not count as Alex owning the card.
 */
function givenNameOnlyAsVocative(
  name: string | null,
  haystack: string,
): boolean {
  const given = creatorTokens(name ?? '')[0];
  if (!given || given.length < 4) return false;
  if (!haystack.includes(given)) return false;
  const vocative = new RegExp(`,\\s*${given}\\b`);
  const first = haystack.indexOf(given);
  const match = vocative.exec(haystack);
  if (!match || match.index !== first) return false;
  // Every occurrence is the same trailing address (or repeats of it).
  let from = 0;
  while (from < haystack.length) {
    const at = haystack.indexOf(given, from);
    if (at < 0) break;
    const before = haystack.slice(Math.max(0, at - 2), at);
    if (!/,\s*$/.test(before) && !(at > 0 && haystack[at - 1] === ',')) {
      return false;
    }
    from = at + given.length;
  }
  return true;
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
  const space = foldHomeText(item.spaceTitle);
  return space.length >= 3 && foldHomeText(haystack).includes(space);
}

/** The words name this proposal, not another one that shares its title. */
function textBelongsTo(item: MemberHomeThreadItem, text: string): boolean {
  const haystack = foldHomeText(text);
  if (!haystack) return false;
  if (creatorNamedInText(item.creatorName, haystack)) return true;
  // "Marco in Hypha Energy has asked to join" names him without the title
  // or the rest of his name. That sentence still belongs to his card.
  // Skip when the name is only a vocative (", Alex.") — that is address.
  if (
    givenNameInText(item.creatorName, haystack) &&
    !givenNameOnlyAsVocative(item.creatorName, haystack) &&
    spaceNamedInText(item, haystack)
  ) {
    return true;
  }
  return (
    titleNamedInText(item.title, haystack) && spaceNamedInText(item, haystack)
  );
}

/** The reply is about this item, even when it never says the title. */
export function memberHomeTextBelongsToItem(
  item: MemberHomeThreadItem,
  text: string,
): boolean {
  return textBelongsTo(item, text);
}

function spokenKind(haystack: string): MemberHomeCardKind | null {
  // Include FR stems so "porte un signal" cannot keep an invite card.
  const signal = /\b(signals?|signaux|notes?|tensions?)\b/.test(haystack);
  const proposal =
    /\b(proposals?|propositions?|invites?|invitations?|votes?|decisions?|d[ée]cisions?)\b/.test(
      haystack,
    );
  if (signal === proposal) return null;
  return signal ? 'signal' : 'proposal';
}

/**
 * A reply names the person and the space, and leaves the title out.
 * Several open items can share that person. The one they are talking
 * about is the name that comes first, in the space named most specifically.
 */
function pickNamedPersonItem(
  items: readonly MemberHomeThreadItem[],
  haystack: string,
): MemberHomeThreadItem | null {
  const named = items.filter((item) => spaceNamedInText(item, haystack));
  const longest = named.reduce(
    (max, item) => Math.max(max, foldHomeText(item.spaceTitle).length),
    0,
  );
  const inSpace =
    longest === 0
      ? []
      : named.filter(
          (item) => foldHomeText(item.spaceTitle).length === longest,
        );
  const byPerson = inSpace.filter(
    (item) =>
      givenNameInText(item.creatorName, haystack) &&
      !givenNameOnlyAsVocative(item.creatorName, haystack),
  );
  if (byPerson.length === 0) return null;
  if (byPerson.length === 1) return byPerson[0] ?? null;
  let earliest = Number.POSITIVE_INFINITY;
  for (const item of byPerson) {
    const given = creatorTokens(item.creatorName ?? '')[0];
    if (!given) continue;
    const index = haystack.indexOf(given);
    if (index >= 0 && index < earliest) earliest = index;
  }
  const subject =
    earliest === Number.POSITIVE_INFINITY
      ? byPerson
      : byPerson.filter((item) => {
          const given = creatorTokens(item.creatorName ?? '')[0];
          return given != null && haystack.indexOf(given) === earliest;
        });
  const kind = spokenKind(haystack);
  const ofKind = kind ? subject.filter((item) => item.kind === kind) : [];
  const pool = ofKind.length > 0 ? ofKind : subject;
  if (pool.length === 1) return pool[0] ?? null;
  const ranked = [...pool].sort(
    (left, right) =>
      textOverlap(right, haystack) - textOverlap(left, haystack) ||
      (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0),
  );
  return ranked[0] ?? null;
}

function itemMentionedInText(
  items: readonly MemberHomeThreadItem[],
  text: string,
): MemberHomeThreadItem | null {
  const haystack = foldHomeText(text);
  if (!haystack) return null;
  const matches = items.filter((item) =>
    titleNamedInText(item.title, haystack),
  );
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
  return pickNamedPersonItem(items, haystack);
}

/** Longer space titles win, so "Hypha" does not swallow "Hypha Energy". */
function mostSpecificSpaceTitles(
  text: string,
  spaceTitles: readonly string[],
): string[] {
  const haystack = foldHomeText(text);
  if (!haystack) return [];
  const hits = [
    ...new Set(
      spaceTitles
        .map((title) => foldHomeText(title))
        .filter((title) => title.length >= 3 && haystack.includes(title)),
    ),
  ];
  return hits.filter(
    (title) =>
      !hits.some(
        (other) =>
          other !== title &&
          other.includes(title) &&
          other.length > title.length,
      ),
  );
}

/**
 * English contractions and fillers that look like "Name's" / "Name has".
 * "Here's the card…" must not claim a creator named "Here".
 */
const CLAIMED_CREATOR_STOPWORDS = new Set([
  'here',
  'there',
  'that',
  'this',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'how',
  'it',
  'he',
  'she',
  'we',
  'they',
  'let',
  'one',
  'someone',
  'anyone',
  'everyone',
  'somebody',
  'anybody',
  'everybody',
  'nobody',
  'something',
  'anything',
  'everything',
  'nothing',
]);

/**
 * Given names the reply treats as authors ("Edgar's thread", "Edgar has put…").
 * Uses capital letters in the original so "space's agreements" is not a person.
 * Content mentions ("Wendy has brought", "Wendy's contribution") are not
 * authorship — those used to clear the member's own card mid-stream.
 */
function claimedCreatorGivens(text: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\b([A-Z][a-zA-Z]{3,})'s\s+(?:thread|signal|proposal|invite|item|work)\b/g,
    /\b([A-Z][a-zA-Z]{3,})’s\s+(?:thread|signal|proposal|invite|item|work)\b/g,
    /\b([A-Z][a-zA-Z]{3,}) has (?:put|raised|opened|named)\b/g,
    /\b([A-Z][a-zA-Z]{3,}) put\b/g,
    /\b([A-Z][a-zA-Z]{3,}) raised\b/g,
    /\b([A-Z][a-zA-Z]{3,}) opened\b/g,
    /\b([A-Z][a-zA-Z]{3,}) is naming\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const given = foldHomeText(match[1] ?? '');
      if (given.length < 4 || CLAIMED_CREATOR_STOPWORDS.has(given)) continue;
      found.add(given);
    }
  }
  return [...found];
}

/** The reply says this member raised the item themselves. */
function textClaimsMemberRaised(text: string): boolean {
  const haystack = foldHomeText(text);
  return (
    /\byou raised\b/.test(haystack) ||
    /\braised it yourself\b/.test(haystack) ||
    /\byour (?:own )?(?:signal|proposal|thread|invite|item)\b/.test(haystack)
  );
}

/**
 * The reply attributes this work to someone else ("Edgar's thread",
 * "Edgar has put…") while the card belongs to a different creator.
 * Works even when that person has no open item in the queue today.
 */
function textClaimsOtherCreator(
  item: MemberHomeThreadItem,
  text: string,
  peerNames: readonly (string | null | undefined)[],
): boolean {
  const haystack = foldHomeText(text);
  if (!haystack) return false;
  // Own signal/proposal brief often names people inside the work
  // ("Wendy has brought…"). That is not a change of author.
  if (item.authoredByMember && textClaimsMemberRaised(text)) return false;
  const own = new Set(creatorTokens(item.creatorName ?? ''));
  const claimed = new Set(claimedCreatorGivens(text));
  for (const name of peerNames) {
    const given = creatorTokens(name ?? '')[0];
    if (!given || given.length < 4) continue;
    if (
      haystack.includes(`${given}'s thread`) ||
      haystack.includes(`${given}'s signal`) ||
      haystack.includes(`${given}'s proposal`) ||
      haystack.includes(`${given}'s invite`) ||
      haystack.includes(`${given}'s item`) ||
      haystack.includes(`${given}'s work`) ||
      haystack.includes(`${given} has put`) ||
      haystack.includes(`${given} has raised`) ||
      haystack.includes(`${given} has opened`) ||
      haystack.includes(`${given} has named`) ||
      haystack.includes(`${given} put`) ||
      haystack.includes(`${given} raised`) ||
      haystack.includes(`${given} opened`) ||
      haystack.includes(`${given} is naming`)
    ) {
      claimed.add(given);
    }
  }
  for (const given of claimed) {
    if (!own.has(given)) return true;
  }
  return false;
}

/**
 * The reply names a space this card is not in, attributes the work to
 * another person, or speaks a different kind (signal vs proposal). A greeting
 * that names no space does not conflict.
 *
 * Naming the creator alone must NOT clear a conflict: "Vlad porte un signal
 * dans la Biorégion…" must never keep Vlad's Flywheel invite card.
 */
export function memberHomeSpeechConflictsWithItem(
  item: MemberHomeThreadItem,
  text: string,
  spaceTitles: readonly string[],
  peerNames: readonly (string | null | undefined)[] = [],
): boolean {
  // Person attribution first: "Edgar's thread …, Alex." must not keep Alex's
  // card just because the listener is named and the space matches.
  if (textClaimsOtherCreator(item, text, peerNames)) return true;
  const haystack = foldHomeText(text);
  const named = mostSpecificSpaceTitles(text, spaceTitles);
  if (named.length > 0 && !named.includes(foldHomeText(item.spaceTitle))) {
    return true;
  }
  const kind = spokenKind(haystack);
  if (kind && kind !== item.kind) return true;
  if (textBelongsTo(item, text)) return false;
  return false;
}

/** The one item in the space the reply actually names. */
function itemInSpokenSpace(
  items: readonly MemberHomeThreadItem[],
  text: string,
): MemberHomeThreadItem | null {
  const named = mostSpecificSpaceTitles(
    text,
    items.map((item) => item.spaceTitle),
  );
  if (named.length !== 1) return null;
  const space = named[0]!;
  const candidates = items.filter(
    (item) => foldHomeText(item.spaceTitle) === space,
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;
  const haystack = foldHomeText(text);
  const byPerson = candidates.filter(
    (item) =>
      creatorNamedInText(item.creatorName, haystack) ||
      (givenNameInText(item.creatorName, haystack) &&
        !givenNameOnlyAsVocative(item.creatorName, haystack)),
  );
  // "Edgar's thread" with no Edgar item: do not fall back to another card.
  const claimed = claimedCreatorGivens(text);
  if (
    claimed.length > 0 &&
    byPerson.length === 0 &&
    !candidates.some((item) => {
      const given = creatorTokens(item.creatorName ?? '')[0];
      return given != null && claimed.includes(given);
    })
  ) {
    return null;
  }
  const pool = byPerson.length > 0 ? byPerson : candidates;
  if (pool.length === 1) return pool[0] ?? null;
  const nameAt = (item: MemberHomeThreadItem) => {
    const given = creatorTokens(item.creatorName ?? '')[0];
    if (!given) return Number.POSITIVE_INFINITY;
    const index = haystack.indexOf(given);
    return index >= 0 ? index : Number.POSITIVE_INFINITY;
  };
  const ranked = [...pool].sort(
    (left, right) =>
      nameAt(left) - nameAt(right) ||
      textOverlap(right, haystack) - textOverlap(left, haystack) ||
      (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0),
  );
  const best = ranked[0];
  if (!best) return null;
  if (byPerson.length > 0 || textOverlap(best, haystack) > 0) return best;
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
  home?: MemberIntelligence,
): MemberHomeThreadItem | null {
  const text = textFromParts(message.parts) || message.content?.trim() || '';
  const mentioned = itemMentionedInText(items, text);
  let toolItem: MemberHomeThreadItem | null = null;
  for (const input of toolInputs(message.parts)) {
    let item = itemFromToolInput(items, input);
    if (
      !item &&
      home &&
      input &&
      typeof input === 'object' &&
      ((input as { kind?: unknown }).kind === 'proposal' ||
        (input as { kind?: unknown }).kind === 'signal') &&
      typeof (input as { slug?: unknown }).slug === 'string'
    ) {
      item = memberHomeThreadItemForRef(home, {
        kind: (input as { kind: MemberHomeCardKind }).kind,
        slug: (input as { slug: string }).slug,
      });
    }
    if (!item) continue;
    toolItem = item;
    break;
  }
  const spaceTitles = items.map((item) => item.spaceTitle);
  const peerNames = items.map((item) => item.creatorName);
  if (
    toolItem &&
    memberHomeSpeechConflictsWithItem(toolItem, text, spaceTitles, peerNames)
  ) {
    if (
      mentioned &&
      !memberHomeSpeechConflictsWithItem(
        mentioned,
        text,
        spaceTitles,
        peerNames,
      )
    ) {
      return mentioned;
    }
    return itemInSpokenSpace(items, text);
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

/**
 * The card that belongs with these words.
 * A hint attached before the model speaks loses when the reply names
 * another space. No card is better than the wrong space.
 */
export function memberHomeCardForSpeech(input: {
  items: readonly MemberHomeThreadItem[];
  message: { parts?: readonly unknown[]; content?: string };
  hinted?: MemberHomeThreadItem | null;
  spaceTitles?: readonly string[];
  home?: MemberIntelligence;
}): MemberHomeThreadItem | null {
  const { items, message } = input;
  const text = textFromParts(message.parts) || message.content?.trim() || '';
  const spaceTitles = [
    ...items.map((item) => item.spaceTitle),
    ...(input.spaceTitles ?? []),
  ];
  const named = memberHomeThreadItemForMessage(items, message, input.home);
  const wordsOnly = memberHomeThreadItemForMessage(
    items,
    { content: text },
    input.home,
  );
  const fromHint = input.hinted ?? null;
  const peerNames = [
    ...items.map((item) => item.creatorName),
    fromHint?.creatorName,
  ];
  const conflicts = (item: MemberHomeThreadItem | null) =>
    Boolean(
      item &&
        memberHomeSpeechConflictsWithItem(item, text, spaceTitles, peerNames),
    );
  if (conflicts(fromHint) || conflicts(named)) {
    if (wordsOnly && !conflicts(wordsOnly)) return wordsOnly;
    const spoken = itemInSpokenSpace(items, text);
    if (spoken && !conflicts(spoken)) return spoken;
    return null;
  }
  const sentencePrefers = (item: MemberHomeThreadItem | null) =>
    Boolean(
      wordsOnly &&
        item &&
        memberHomeThreadItemKey(wordsOnly) !== memberHomeThreadItemKey(item) &&
        textBelongsTo(wordsOnly, text) &&
        !textBelongsTo(item, text),
    );
  if (sentencePrefers(fromHint) || sentencePrefers(named)) return wordsOnly;
  return fromHint ?? wordsOnly ?? named;
}

function memberHomeChoiceText(text: string) {
  return text.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}

/** Hidden prompt when home opens and the talk should keep going. */
export const MEMBER_HOME_CONTINUE_ASK = 'Continue with what still needs me.';

const HOME_STOP =
  /^(?:stop|pause|enough|that(?:'| i)?s enough|i(?:'| a)?m done|stop for now|enough for now|let's pause|lets pause|pause for now)[.!?]?$/i;

const HOME_PAUSE_YES =
  /^(?:yes|yeah|yep|yup|sure|ok|okay|please|let's pause|lets pause|pause)[.!?]?$/i;

function messageIsHomeArrival(message: { metadata?: unknown }): boolean {
  const metadata = message.metadata;
  return (
    metadata != null &&
    typeof metadata === 'object' &&
    'homeArrival' in metadata &&
    (metadata as { homeArrival?: unknown }).homeArrival === true
  );
}

/**
 * The talk rests only when they asked to stop, or agreed to a pause the
 * assistant just offered. Anything else means home should keep going.
 */
export function memberHomeTalkIsResting(
  messages: ReadonlyArray<{
    role: string;
    parts?: readonly unknown[];
    content?: string;
    metadata?: unknown;
  }>,
): boolean {
  let offeredPause = false;
  let resting = false;
  for (const message of messages) {
    const text = textFromParts(message.parts) || message.content?.trim() || '';
    if (message.role === 'assistant') {
      offeredPause = /pause for now/i.test(text);
      continue;
    }
    if (message.role !== 'user' || messageIsHomeArrival(message)) continue;
    const normalized = memberHomeChoiceText(text);
    if (!normalized) continue;
    if (
      HOME_STOP.test(normalized) ||
      (offeredPause && HOME_PAUSE_YES.test(normalized))
    ) {
      resting = true;
    } else {
      resting = false;
    }
    offeredPause = false;
  }
  return resting;
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
 * They are asking to see the item. That is not a yes that drops it,
 * and it is not a no.
 */
/** "show" on its own means the card from the reply just above. */
function isBareCardLook(text: string): boolean {
  const folded = foldHomeText(text)
    .replace(/[.!?]+$/g, '')
    .trim();
  return /^(?:show(?: (?:it|that|this|the card))?|montre(?:-(?:le|la|moi)| (?:le|la|moi|ca|la carte))?|affiche(?:-(?:le|la)| (?:la carte))?|zeig(?: (?:es|die karte))?|muestra(?:lo| (?:la tarjeta))?|mostra(?: (?:isso|a carta))?|toon(?: het)?|laat zien|vis(?: det)?|покажи(?: ја)?)$/.test(
    folded,
  );
}

export function isMemberHomeItemLook(text: string): boolean {
  const normalized = memberHomeChoiceText(text);
  if (!normalized) return false;
  if (isBareCardLook(text)) return true;
  if (
    /\b(don't see|do not see|dont see|can't see|cannot see|not seeing)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /\b(show me|let me see|where is it|where is the|where is that)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /\b(show|see|open)\b/.test(normalized) &&
    /\b(proposal|invite|card|it)\b/.test(normalized)
  ) {
    return true;
  }
  if (/\bopen\b/.test(normalized)) return true;
  return (
    /\b(go to|take me)\b/.test(normalized) &&
    /\b(proposal|invite|card|it|there|space)\b/.test(normalized)
  );
}

/** The item they are asking to see, from the reply before this message. */
export function memberHomeLookItem(
  items: readonly MemberHomeThreadItem[],
  messages: ReadonlyArray<MemberHomeMemoryMessage>,
  asked: string,
): MemberHomeThreadItem | null {
  if (!isMemberHomeItemLook(asked)) return null;
  const previous = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const hinted = previous?.metadata?.homeItem;
  if (hinted?.kind && hinted.slug) {
    const match = items.find(
      (item) => item.kind === hinted.kind && item.slug === hinted.slug,
    );
    if (match) return match;
  }
  const fromWords = previous
    ? memberHomeThreadItemForMessage(items, previous)
    : null;
  if (fromWords) return fromWords;
  const memory = memberHomeItemMemory(items, messages);
  const key = memory.recalled[0] ?? memory.deferred[0] ?? null;
  if (key) {
    const remembered = items.find(
      (item) => memberHomeThreadItemKey(item) === key,
    );
    if (remembered) return remembered;
  }
  const askedText = memberHomeChoiceText(asked);
  const bySpace = items.filter((item) =>
    foldHomeText(item.spaceTitle)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 5)
      .some((token) => askedText.includes(token)),
  );
  if (bySpace.length === 1) return bySpace[0] ?? null;
  const decisions = items.filter(
    (item) => item.kind === 'proposal' && item.action === 'decision',
  );
  if (decisions.length === 1 && /\b(proposal|invite|card)\b/.test(askedText)) {
    return decisions[0] ?? null;
  }
  return bySpace[0] ?? null;
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
  metadata?: {
    homeItem?: { kind?: string; slug?: string };
  };
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
    if (isMemberHomeItemLook(text)) continue;
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

export type MemberHomeDirectAsk =
  | 'people'
  | 'spaces'
  | 'tokens'
  | 'decision'
  | 'useful';

export type MemberHomeDirectLine =
  | { key: 'people'; name: string; count: number }
  | { key: 'peopleEmpty' }
  | { key: 'space'; space: string }
  | { key: 'spaceEmpty' }
  | { key: 'tokens'; name: string }
  | { key: 'tokensEmpty' }
  | { key: 'decisionOpen'; title: string; space: string }
  | { key: 'decisionListed'; title: string; space: string }
  | { key: 'decisionQuiet' }
  | { key: 'itemOpen'; title: string; space: string }
  | { key: 'usefulQuiet' };

/** A chip the screen already answered. Null means the model may speak. */
export type MemberHomeDirectReply = {
  ask: MemberHomeDirectAsk;
  widget: 'people' | 'spaces' | 'tokens' | null;
  item: { kind: MemberHomeCardKind; slug: string } | null;
  line: MemberHomeDirectLine;
};

const DIRECT_PHRASES: Record<MemberHomeDirectAsk, readonly string[]> = {
  people: [
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
  ],
  spaces: [
    'step into a space',
    'entrar en un espacio',
    'entrer dans un espace',
    'entrar num espaço',
    'einen space betreten',
    'stap een space binnen',
    'gå inn i et rom',
    'влези во простор',
  ],
  tokens: [
    'send someone tokens',
    'enviar tokens a alguien',
    'envoyer des tokens à quelqu’un',
    "envoyer des tokens à quelqu'un",
    'enviar tokens a alguém',
    'jemandem token senden',
    'iemand tokens sturen',
    'send tokens til noen',
    'испрати токени на некого',
  ],
  decision: ['what needs a decision', 'where is my voice needed'],
  useful: ['where can i be useful', 'i am on my home'],
};

function foldDirectAsk(text: string) {
  let chip = text
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
  while (chip.startsWith('¿') || chip.startsWith('¡')) chip = chip.slice(1);
  while (chip.endsWith('.') || chip.endsWith('!') || chip.endsWith('?')) {
    chip = chip.slice(0, -1);
  }
  return chip.trim();
}

function classifyDirectAsk(
  asked: string,
  phrases?: Partial<Record<MemberHomeDirectAsk, readonly string[]>>,
): MemberHomeDirectAsk | null {
  const chip = foldDirectAsk(asked);
  if (!chip) return null;
  const order: MemberHomeDirectAsk[] = [
    'people',
    'spaces',
    'tokens',
    'decision',
    'useful',
  ];
  for (const ask of order) {
    const extra = phrases?.[ask] ?? [];
    const known = [...DIRECT_PHRASES[ask], ...extra];
    if (known.some((phrase) => foldDirectAsk(phrase) === chip)) return ask;
  }
  if (chip.includes('what needs a decision')) return 'decision';
  return null;
}

function closestDirectPerson(home: MemberIntelligence) {
  const named = home.connections.filter((person) => {
    if (person.id === home.person.id) return false;
    const name = [person.name, person.surname].filter(Boolean).join(' ').trim();
    return Boolean(name || person.nickname?.trim());
  });
  named.sort((left, right) => right.sharedSpaceCount - left.sharedSpaceCount);
  const person = named[0];
  if (!person) return null;
  const name =
    [person.name, person.surname].filter(Boolean).join(' ').trim() ||
    person.nickname?.trim() ||
    '';
  if (!name) return null;
  return { name, count: person.sharedSpaceCount };
}

function leadDirectSpace(
  home: MemberIntelligence,
  recentSpaceSlugs: readonly string[],
) {
  const bySlug = new Map(home.spaces.map((space) => [space.slug, space]));
  for (const slug of recentSpaceSlugs) {
    const space = bySlug.get(slug);
    if (space?.title.trim()) return space.title.trim();
  }
  return home.spaces.find((space) => space.title.trim())?.title.trim() ?? null;
}

function notificationProposals(home: MemberIntelligence) {
  return [...home.notifications]
    .filter(
      (item) =>
        item.kind === 'proposal' &&
        item.title.trim() &&
        item.spaceTitle.trim() &&
        item.targetSlug.trim(),
    )
    .sort((left, right) => {
      const leftAt = left.at ?? '';
      const rightAt = right.at ?? '';
      if (leftAt !== rightAt) return leftAt < rightAt ? 1 : -1;
      return left.id < right.id ? -1 : 1;
    });
}

function openDecisions(home: MemberIntelligence) {
  return listMemberHomeThreadCatalog(home).filter(
    (item) =>
      item.kind === 'proposal' &&
      item.action === 'decision' &&
      item.slug.trim() &&
      item.title.trim() &&
      item.spaceTitle.trim(),
  );
}

/**
 * The card for a kind and slug. Open items come from the catalog. A
 * notification that is no longer waiting still gets a card from the proposal.
 */
export function memberHomeThreadItemForRef(
  home: MemberIntelligence,
  ref: { kind: MemberHomeCardKind; slug: string },
): MemberHomeThreadItem | null {
  const slug = ref.slug.trim();
  if (!slug) return null;
  const fromCatalog = listMemberHomeThreadCatalog(home).find(
    (item) => item.kind === ref.kind && item.slug === slug,
  );
  if (fromCatalog) return fromCatalog;
  if (ref.kind === 'signal') {
    // Own-space signals carry dueAt/roomId. Network horizon rows do not —
    // keep them separate so the union never pretends they share those fields.
    const ownSignal = home.signals.find((row) => row.slug === slug);
    const networkSignal = (home.networkSignals ?? []).find(
      (row) => row.slug === slug,
    );
    const signal = ownSignal ?? networkSignal;
    const note = [...home.notifications, ...home.attention].find(
      (row) => row.kind === 'signal' && row.targetSlug === slug,
    );
    if (!signal && !note) return null;
    const title = (signal?.title ?? note?.title ?? '').trim();
    const spaceTitle = (signal?.spaceTitle ?? note?.spaceTitle ?? '').trim();
    if (!title || !spaceTitle) return null;
    const creatorId = signal?.creatorId ?? note?.creatorId ?? null;
    return {
      kind: 'signal',
      slug,
      title,
      spaceSlug: signal?.spaceSlug || note?.spaceSlug || '',
      spaceTitle,
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: raisedByMember(home, creatorId),
      spaceLogo: signal?.spaceLogo ?? note?.spaceLogo ?? null,
      category: memberHomeSignalCategory(signal?.type, note?.category),
      summary: signal?.description ?? note?.summary ?? null,
      dueAt: ownSignal?.dueAt ?? null,
      creatorId,
      creatorName: signal?.creatorName ?? note?.creatorName ?? null,
      creatorAvatarUrl:
        signal?.creatorAvatarUrl ?? note?.creatorAvatarUrl ?? null,
      ...(typeof signal?.id === 'number' ? { signalId: signal.id } : {}),
      ...(ownSignal?.roomId?.trim() ? { roomId: ownSignal.roomId.trim() } : {}),
    };
  }
  if (ref.kind !== 'proposal') return null;
  const proposal = home.proposals.find((row) => row.slug === slug);
  const note = [...home.notifications, ...home.attention].find(
    (row) => row.kind === 'proposal' && row.targetSlug === slug,
  );
  if (!proposal && !note) return null;
  const title = (proposal?.title ?? note?.title ?? '').trim();
  const spaceTitle = (proposal?.spaceTitle ?? note?.spaceTitle ?? '').trim();
  if (!title || !spaceTitle) return null;
  if (proposal?.expired && proposal.outcome) {
    return {
      kind: 'proposal',
      slug,
      title,
      spaceSlug: proposal.spaceSlug || note?.spaceSlug || '',
      spaceTitle,
      action: 'outcome',
      documentKind: memberHomeDocumentKind({
        kind: 'proposal',
        state: proposal.state,
        label: proposal.label,
      }),
      authoredByMember: proposal.authoredByMember,
      spaceLogo: proposal.spaceLogo ?? note?.spaceLogo ?? null,
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
    };
  }
  return {
    kind: 'proposal',
    slug,
    title,
    spaceSlug: proposal?.spaceSlug || note?.spaceSlug || '',
    spaceTitle,
    action: 'decision',
    documentKind: memberHomeDocumentKind({
      kind: 'proposal',
      state: proposal?.state,
      label: proposal?.label,
    }),
    authoredByMember: proposal?.authoredByMember ?? false,
    spaceLogo: proposal?.spaceLogo ?? note?.spaceLogo ?? null,
    category: proposal?.label ?? null,
    summary: proposal?.description ?? null,
    creatorId: proposal?.creatorId ?? null,
    creatorName: proposal?.creatorName ?? null,
    creatorAvatarUrl: proposal?.creatorAvatarUrl ?? null,
    documentId: proposal?.id ?? null,
    web3ProposalId: proposal?.web3ProposalId ?? null,
    web3SpaceId: proposal?.web3SpaceId ?? null,
  };
}

/**
 * Chips the member can see. The reply is the record on screen, so the model
 * cannot send them to another space or call an open invite a closed queue.
 */
export function memberHomeDirectReply(
  home: MemberIntelligence,
  asked: string,
  options?: {
    recentSpaceSlugs?: readonly string[];
    phrases?: Partial<Record<MemberHomeDirectAsk, readonly string[]>>;
  },
): MemberHomeDirectReply | null {
  const ask = classifyDirectAsk(asked, options?.phrases);
  if (!ask) return null;
  if (ask === 'people') {
    const person = closestDirectPerson(home);
    return {
      ask,
      widget: 'people',
      item: null,
      line: person
        ? { key: 'people', name: person.name, count: person.count }
        : { key: 'peopleEmpty' },
    };
  }
  if (ask === 'spaces') {
    const space = leadDirectSpace(home, options?.recentSpaceSlugs ?? []);
    return {
      ask,
      widget: 'spaces',
      item: null,
      line: space ? { key: 'space', space } : { key: 'spaceEmpty' },
    };
  }
  if (ask === 'tokens') {
    const person = closestDirectPerson(home);
    return {
      ask,
      widget: 'tokens',
      item: null,
      line: person
        ? { key: 'tokens', name: person.name }
        : { key: 'tokensEmpty' },
    };
  }
  if (ask === 'decision') {
    const open = openDecisions(home);
    const notes = notificationProposals(home);
    const listedOpen = notes.find((note) =>
      open.some((item) => item.slug === note.targetSlug),
    );
    const chosen = listedOpen
      ? open.find((item) => item.slug === listedOpen.targetSlug)
      : open[0];
    if (chosen) {
      // Open decisions are a conversation, not a title dump
      // ("Deliverable Contribution — X is open in Y"). Same as useful:
      // the model briefs the person and the need.
      return null;
    }
    const listed = notes[0];
    if (listed) {
      return {
        ask,
        widget: null,
        item: { kind: 'proposal', slug: listed.targetSlug },
        line: {
          key: 'decisionListed',
          title: listed.title.trim(),
          space: listed.spaceTitle.trim(),
        },
      };
    }
    return {
      ask,
      widget: null,
      item: null,
      line: { key: 'decisionQuiet' },
    };
  }
  // Arrival and "where can I be useful" are a conversation, not a label.
  // The model starts it. A title-and-space line is what kept coming back.
  return null;
}
