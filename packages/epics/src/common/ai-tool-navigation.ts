'use client';

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
  const navigation = args.output?.navigation as ChatToolNavigation | undefined;
  const href = navigation?.href?.trim();
  if (!href || args.output?.ok !== true) return null;

  const openHumanChat =
    navigation?.open_human_chat === true ||
    args.toolName === 'create_human_chat_message';

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
  }

  const focusField = navigation?.focus_field?.trim() || undefined;
  const focusSection = navigation?.focus_section?.trim() || undefined;
  const resubmitPayload =
    args.toolName === 'prepare_governance_proposal' &&
    args.output?.resubmit_payload &&
    typeof args.output.resubmit_payload === 'object'
      ? (args.output.resubmit_payload as Record<string, unknown>)
      : undefined;
  const payloadFingerprint = resubmitPayload
    ? JSON.stringify(resubmitPayload)
    : '';

  return {
    href,
    openInNewTab: navigation?.open_in_new_tab === true,
    openHumanChat,
    toolName: args.toolName,
    resubmitPayload,
    focusField,
    focusSection,
    coherenceChat,
    key: `${args.messageId}:${args.partKey}:${href}:${focusField ?? ''}:${
      focusSection ?? ''
    }:${payloadFingerprint.slice(0, 120)}`,
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
    if (targets[0]) return targets[0];
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
