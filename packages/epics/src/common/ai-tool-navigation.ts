'use client';

import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { normalizeAppPath } from './proposal-form-navigation';

type ChatToolNavigation = {
  href?: string;
  open_in_new_tab?: boolean;
  open_human_chat?: boolean;
  chat_target?: 'space_chat' | 'signal_chat';
  signal_slug?: string;
  signal_title?: string;
  room_id?: string;
  message_event_id?: string;
  focus_field?: string;
  focus_section?: string;
};

export type AiPanelNavigationTarget = {
  href: string;
  openInNewTab: boolean;
  openHumanChat: boolean;
  toolName: string;
  proposalType?: string;
  resubmitPayload?: Record<string, unknown>;
  focusField?: string;
  focusSection?: string;
  coherenceChat?: {
    roomId: string | null;
    title: string;
    slug: string;
  };
  key: string;
};

/** Prefer signal-create navigation over generic mcp_navigation in the same turn. */
const NAVIGATION_TOOL_PRIORITY = [
  'create_space_signal_by_slug',
  'relay_ecosystem_signal',
  'create_human_chat_message',
  'create_ecosystem_space',
  'summarize_space_discussion_by_slug',
  'ingest_space_call_artifacts',
  'prepare_governance_proposal',
  'mcp_navigation',
] as const;

export const IMMEDIATE_AUTO_NAVIGATION_TOOLS = new Set<string>([
  'create_space_signal_by_slug',
  'relay_ecosystem_signal',
  'create_human_chat_message',
]);

function navigationToolPriority(toolName: string): number {
  const index = NAVIGATION_TOOL_PRIORITY.indexOf(
    toolName as (typeof NAVIGATION_TOOL_PRIORITY)[number],
  );
  return index === -1 ? NAVIGATION_TOOL_PRIORITY.length : index;
}

export function pickBestNavigationTarget(
  targets: AiPanelNavigationTarget[],
): AiPanelNavigationTarget | null {
  if (targets.length === 0) return null;
  return (
    [...targets].sort(
      (a, b) =>
        navigationToolPriority(a.toolName) - navigationToolPriority(b.toolName),
    )[0] ?? null
  );
}

function getSpaceTabSection(pathname: string): string | null {
  const match = pathname.match(/\/dho\/[^/]+\/([^/?]+)/);
  return match?.[1] ?? null;
}

/** Do not replay stale AI overview navigation after the member opened another space tab. */
export function shouldSkipStaleOverviewAutoNavigation(
  currentPathname: string,
  targetHref: string,
): boolean {
  try {
    const target = new URL(targetHref, 'http://localhost');
    const targetSection = getSpaceTabSection(target.pathname);
    if (targetSection !== 'overview') return false;

    const currentSpace = getDhoSpaceSlugFromPathname(currentPathname);
    const targetSpace = getDhoSpaceSlugFromPathname(target.pathname);
    if (!currentSpace || !targetSpace || currentSpace !== targetSpace) {
      return false;
    }

    const currentSection = getSpaceTabSection(currentPathname);
    return Boolean(currentSection && currentSection !== 'overview');
  } catch {
    return false;
  }
}

export function isAtNavigationTarget(
  href: string,
  pathname: string,
  search: string,
): boolean {
  try {
    const target = new URL(href, 'http://localhost');
    if (normalizeAppPath(pathname) !== normalizeAppPath(target.pathname)) {
      return false;
    }

    const targetSignal = target.searchParams.get('signal')?.trim();
    if (!targetSignal) return true;

    const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
    const currentSignal = new URLSearchParams(normalizedSearch)
      .get('signal')
      ?.trim();
    return currentSignal === targetSignal;
  } catch {
    return false;
  }
}

type ChatMessageForNavigation = {
  id?: string;
  role?: string;
  parts?: unknown;
  toolInvocations?: unknown;
};

function isCompletedToolState(state: unknown): boolean {
  if (typeof state !== 'string') return true;
  return (
    state === 'output-available' ||
    state === 'output_available' ||
    state === 'done' ||
    state === 'completed'
  );
}

function parseNavigationTarget(args: {
  toolName: string;
  output: Record<string, unknown> | undefined;
  messageId: string;
  partKey: string;
}): AiPanelNavigationTarget | null {
  if (args.output?.ok !== true) return null;

  const navigation = args.output?.navigation as ChatToolNavigation | undefined;
  let href = navigation?.href?.trim();

  if (
    !href &&
    (args.toolName === 'create_space_signal_by_slug' ||
      args.toolName === 'relay_ecosystem_signal')
  ) {
    const spaceSlug =
      (typeof args.output.spaceSlug === 'string' && args.output.spaceSlug) ||
      (typeof args.output.targetSpaceSlug === 'string' &&
        args.output.targetSpaceSlug) ||
      '';
    const signalSlug =
      typeof args.output.signalSlug === 'string'
        ? args.output.signalSlug.trim()
        : '';
    if (spaceSlug && signalSlug) {
      const params = new URLSearchParams();
      params.set('signal', signalSlug);
      href = `/en/dho/${spaceSlug}/coherence?${params.toString()}`;
    }
  }

  if (
    !href &&
    args.output?.ok === true &&
    (args.toolName === 'summarize_space_discussion_by_slug' ||
      args.toolName === 'ingest_space_call_artifacts')
  ) {
    const spaceSlug =
      typeof args.output.space_slug === 'string'
        ? args.output.space_slug.trim()
        : '';
    if (spaceSlug) {
      href = `/en/dho/${spaceSlug}/memory`;
    }
  }

  if (
    !href &&
    args.output?.ok === true &&
    args.toolName === 'create_ecosystem_space' &&
    args.output.requires_confirmation !== true &&
    args.output.space &&
    typeof args.output.space === 'object'
  ) {
    const space = args.output.space as { slug?: string };
    const spaceSlug = space.slug?.trim();
    if (spaceSlug) {
      href = `/en/dho/${spaceSlug}/overview`;
    }
  }

  if (!href) return null;

  const openHumanChat =
    navigation?.open_human_chat === true ||
    args.toolName === 'create_human_chat_message' ||
    args.toolName === 'create_space_signal_by_slug' ||
    args.toolName === 'relay_ecosystem_signal';

  let coherenceChat: AiPanelNavigationTarget['coherenceChat'];
  if (
    openHumanChat &&
    navigation?.chat_target === 'signal_chat' &&
    navigation.signal_slug?.trim()
  ) {
    coherenceChat = {
      roomId: navigation.room_id?.trim() || null,
      title: navigation.signal_title?.trim() || navigation.signal_slug.trim(),
      slug: navigation.signal_slug.trim(),
    };
  } else if (
    openHumanChat &&
    (args.toolName === 'create_space_signal_by_slug' ||
      args.toolName === 'relay_ecosystem_signal')
  ) {
    const signalSlug =
      typeof args.output.signalSlug === 'string'
        ? args.output.signalSlug.trim()
        : navigation?.signal_slug?.trim() || '';
    const signalTitle =
      typeof args.output.title === 'string'
        ? args.output.title.trim()
        : navigation?.signal_title?.trim() || signalSlug;
    if (signalSlug) {
      coherenceChat = {
        roomId: navigation?.room_id?.trim() || null,
        title: signalTitle,
        slug: signalSlug,
      };
    }
  }

  const focusField = navigation?.focus_field?.trim() || undefined;
  const focusSection = navigation?.focus_section?.trim() || undefined;
  const resubmitPayload =
    args.toolName === 'prepare_governance_proposal' &&
    args.output?.resubmit_payload &&
    typeof args.output.resubmit_payload === 'object'
      ? (args.output.resubmit_payload as Record<string, unknown>)
      : undefined;
  const proposalType =
    args.toolName === 'prepare_governance_proposal' &&
    typeof args.output?.proposal_type === 'string'
      ? args.output.proposal_type.trim()
      : undefined;
  const payloadFingerprint = resubmitPayload
    ? JSON.stringify(resubmitPayload)
    : '';

  return {
    href,
    openInNewTab: navigation?.open_in_new_tab === true,
    openHumanChat,
    toolName: args.toolName,
    proposalType,
    resubmitPayload,
    focusField,
    focusSection,
    coherenceChat,
    key: `${args.messageId}:${args.partKey}:${href}:${focusField ?? ''}:${
      focusSection ?? ''
    }:${payloadFingerprint}`,
  };
}

function collectNavigationTargetsFromMessage(
  message: ChatMessageForNavigation,
  messageIndex: number,
  allowed: Set<string>,
): AiPanelNavigationTarget[] {
  const targets: AiPanelNavigationTarget[] = [];
  const messageId = message.id ?? `m-${messageIndex}`;

  const toolInvocations = Array.isArray(message.toolInvocations)
    ? message.toolInvocations
    : [];

  for (
    let invocationIndex = toolInvocations.length - 1;
    invocationIndex >= 0;
    invocationIndex -= 1
  ) {
    const invocation = toolInvocations[invocationIndex];
    if (!invocation || typeof invocation !== 'object') continue;
    const toolName =
      (typeof (invocation as { toolName?: unknown }).toolName === 'string' &&
        (invocation as { toolName: string }).toolName) ||
      (typeof (invocation as { tool?: unknown }).tool === 'string' &&
        (invocation as { tool: string }).tool) ||
      '';
    if (!allowed.has(toolName)) continue;
    if (!isCompletedToolState((invocation as { state?: unknown }).state)) {
      continue;
    }
    const output =
      ((invocation as { result?: Record<string, unknown> }).result as
        | Record<string, unknown>
        | undefined) ??
      ((invocation as { output?: Record<string, unknown> }).output as
        | Record<string, unknown>
        | undefined);
    const target = parseNavigationTarget({
      toolName,
      output,
      messageId,
      partKey: `toolInvocation:${invocationIndex}`,
    });
    if (target) targets.push(target);
  }

  const parts = Array.isArray(message.parts) ? message.parts : [];
  for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
    const part = parts[partIndex];
    if (!part || typeof part !== 'object') continue;
    const partType = (part as { type?: unknown }).type;
    if (typeof partType !== 'string') continue;
    const toolName = partType.startsWith('tool-')
      ? partType.slice('tool-'.length)
      : '';
    if (!allowed.has(toolName)) continue;
    if (!isCompletedToolState((part as { state?: unknown }).state)) continue;
    const output = (part as { output?: Record<string, unknown> }).output;
    const target = parseNavigationTarget({
      toolName,
      output,
      messageId,
      partKey: `part:${partIndex}`,
    });
    if (target) targets.push(target);
  }

  return targets;
}

export function findLatestPrepareGovernanceProposalUpdate(
  messages: ChatMessageForNavigation[],
): AiPanelNavigationTarget | null {
  return findLatestAiPanelNavigationTarget(messages, [
    'prepare_governance_proposal',
  ]);
}

export function findLatestAiPanelNavigationTarget(
  messages: ChatMessageForNavigation[],
  toolNames: string[],
): AiPanelNavigationTarget | null {
  const allowed = new Set(toolNames);

  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const message = messages[messageIndex];
    if (!message) continue;

    const targets = collectNavigationTargetsFromMessage(
      message,
      messageIndex,
      allowed,
    );
    const best = pickBestNavigationTarget(targets);
    if (best) return best;
  }

  return null;
}

/** All prepare_governance_proposal navigation keys in chat — used to ignore stale AI drafts after Publish. */
export function collectGovernancePrepareNavigationKeys(
  messages: ChatMessageForNavigation[],
): string[] {
  const allowed = new Set(['prepare_governance_proposal']);
  const keys = new Set<string>();

  for (
    let messageIndex = 0;
    messageIndex < messages.length;
    messageIndex += 1
  ) {
    const message = messages[messageIndex];
    if (!message) continue;
    for (const target of collectNavigationTargetsFromMessage(
      message,
      messageIndex,
      allowed,
    )) {
      keys.add(target.key);
    }
  }

  return [...keys];
}
