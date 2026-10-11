import type { MemberIntelligence } from './member-intelligence';

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
  action: 'decision' | 'validate';
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
};

export type MemberHomeSignalCta =
  | 'help'
  | 'share'
  | 'take'
  | 'impact'
  | 'discuss'
  | 'call'
  | 'context'
  | 'later';

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
 * What the home assistant should bring into the conversation.
 * Notifications lead, then any other open decision or assigned signal.
 * The same slug is never listed twice.
 */
export function listMemberHomeThreadItems(
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
    if (!slug) return;
    const key = memberHomeThreadItemKey({ ...item, slug });
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      ...item,
      slug,
      spaceLogo: item.spaceLogo ?? logosBySlug.get(item.spaceSlug) ?? null,
    });
  };

  const pushProposal = (proposal: MemberIntelligence['proposals'][number]) => {
    if (!proposal.slug) return;
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
    push({
      kind: 'signal',
      slug: note.targetSlug,
      title: signal?.title ?? note.title,
      spaceSlug: signal?.spaceSlug ?? note.spaceSlug,
      spaceTitle: signal?.spaceTitle ?? note.spaceTitle,
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: false,
      category: signal?.type ?? note.category ?? null,
      summary: signal?.description ?? note.summary ?? null,
      creatorId: signal?.creatorId ?? note.creatorId ?? null,
      creatorName: signal?.creatorName ?? note.creatorName ?? null,
      creatorAvatarUrl:
        signal?.creatorAvatarUrl ?? note.creatorAvatarUrl ?? null,
    });
  }

  for (const proposal of home.proposals) {
    pushProposal(proposal);
  }

  for (const signal of home.signals) {
    if (!signal.slug || !signal.assignedToMember) continue;
    push({
      kind: 'signal',
      slug: signal.slug,
      title: signal.title,
      spaceSlug: signal.spaceSlug,
      spaceTitle: signal.spaceTitle,
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: false,
      category: signal.type,
      summary: signal.description,
      creatorId: signal.creatorId,
      creatorName: signal.creatorName,
      creatorAvatarUrl: signal.creatorAvatarUrl,
    });
  }

  for (const signal of home.networkSignals ?? []) {
    if (!signal.slug) continue;
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
      category: signal.type,
      summary: signal.description,
      creatorId: signal.creatorId,
      creatorName: signal.creatorName,
      creatorAvatarUrl: signal.creatorAvatarUrl,
    });
  }

  return items;
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
    };
    const type = typeof record.type === 'string' ? record.type : '';
    const named =
      type === `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}` ||
      (type === 'dynamic-tool' &&
        record.toolName === SHOW_MEMBER_HOME_ITEM_TOOL);
    if (!named) continue;
    if (record.state === 'input-streaming') continue;
    inputs.push(record.input);
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
  if (matches.length === 1 && matches[0]) return matches[0];
  const byCreator = items.filter((item) => {
    const name = item.creatorName?.trim().toLowerCase() ?? '';
    return name.includes(' ') && haystack.includes(name);
  });
  return byCreator.length === 1 && byCreator[0] ? byCreator[0] : null;
}

/**
 * The card for this assistant reply.
 * A `show_member_home_item` call wins. Otherwise the reply must name exactly
 * one waiting title, so a greeting never draws the whole set.
 */
export function memberHomeThreadItemForMessage(
  items: readonly MemberHomeThreadItem[],
  message: { parts?: readonly unknown[]; content?: string },
): MemberHomeThreadItem | null {
  for (const input of toolInputs(message.parts)) {
    const item = itemFromToolInput(items, input);
    if (item) return item;
  }
  const text = textFromParts(message.parts) || message.content?.trim() || '';
  return itemMentionedInText(items, text);
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
  let held: string | null = null;

  for (const message of messages) {
    if (message.role === 'assistant') {
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
      declines.set(currentKey, (declines.get(currentKey) ?? 0) + 1);
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
