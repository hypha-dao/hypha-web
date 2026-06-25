'use client';

import type { OnboardingConversationContext } from './ai-onboarding-context';
import {
  AI_PANEL_SETUP_SOURCE,
  getPostOnboardingContinuationPrompt,
  ONBOARDING_HERO_SOURCE,
} from './ai-onboarding-context';

export type EcosystemBlueprintEntry = {
  key: string;
  role: string;
  title: string;
  status: 'planned' | 'confirmed' | 'created';
};

type MessagePart = {
  type?: string;
  state?: string;
  output?: unknown;
};

type MessageWithParts = {
  parts?: MessagePart[];
};

const BLUEPRINT_TOOL_TYPES = new Set([
  'tool-propose_organisation_blueprint',
  'tool-generate_ecosystem_blueprint',
]);

function isCompletedToolPart(state: unknown): boolean {
  if (typeof state !== 'string') return true;
  return (
    state === 'output-available' ||
    state === 'output_available' ||
    state === 'done' ||
    state === 'completed'
  );
}

function parseBlueprintNodesFromOutput(
  output: unknown,
): EcosystemBlueprintEntry[] | null {
  if (!output || typeof output !== 'object') return null;
  const value = output as {
    ok?: boolean;
    blueprint?: {
      nodes?: unknown;
    };
  };
  if (value.ok === false || !value.blueprint?.nodes) return null;
  if (!Array.isArray(value.blueprint.nodes)) return null;

  const entries: EcosystemBlueprintEntry[] = [];
  for (const rawNode of value.blueprint.nodes) {
    if (!rawNode || typeof rawNode !== 'object') continue;
    const node = rawNode as {
      key?: unknown;
      role?: unknown;
      title?: unknown;
      status?: unknown;
    };
    if (
      typeof node.key !== 'string' ||
      !node.key.trim() ||
      typeof node.role !== 'string' ||
      !node.role.trim() ||
      typeof node.title !== 'string' ||
      !node.title.trim()
    ) {
      continue;
    }
    const status =
      node.status === 'confirmed' ||
      node.status === 'created' ||
      node.status === 'planned'
        ? node.status
        : 'planned';
    entries.push({
      key: node.key.trim(),
      role: node.role.trim(),
      title: node.title.trim(),
      status,
    });
  }

  return entries.length > 0 ? entries : null;
}

function blueprintEntriesEqual(
  left: EcosystemBlueprintEntry[] | undefined,
  right: EcosystemBlueprintEntry[] | undefined,
): boolean {
  if (!left && !right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((entry, index) => {
    const other = right[index];
    return (
      entry.key === other?.key &&
      entry.role === other?.role &&
      entry.title === other?.title &&
      entry.status === other?.status
    );
  });
}

/** Recover the latest ecosystem blueprint from onboarding chat tool output. */
export function extractEcosystemBlueprintFromMessages(
  messages: MessageWithParts[],
): EcosystemBlueprintEntry[] | null {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const parts = messages[messageIndex]?.parts ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (!part || typeof part !== 'object') continue;
      const type = typeof part.type === 'string' ? part.type : '';
      if (!BLUEPRINT_TOOL_TYPES.has(type)) continue;
      if (!isCompletedToolPart(part.state)) continue;
      const parsed = parseBlueprintNodesFromOutput(part.output);
      if (parsed) return parsed;
    }
  }
  return null;
}

type CreatedEcosystemSpace = {
  slug: string;
  role?: string;
};

function collectCreatedEcosystemSpaces(
  messages: MessageWithParts[],
): CreatedEcosystemSpace[] {
  const created: CreatedEcosystemSpace[] = [];
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (!part || typeof part !== 'object') continue;
      const type = typeof part.type === 'string' ? part.type : '';
      if (type !== 'tool-create_ecosystem_space') continue;
      if (!isCompletedToolPart(part.state)) continue;
      const output = part.output as
        | {
            ok?: boolean;
            space?: { slug?: string; role_in_ecosystem?: string };
          }
        | undefined;
      if (output?.ok !== true) continue;
      const slug = output.space?.slug?.trim();
      if (!slug) continue;
      created.push({
        slug,
        role:
          typeof output.space?.role_in_ecosystem === 'string'
            ? output.space.role_in_ecosystem
            : undefined,
      });
    }
  }
  return created;
}

function matchesBlueprintKey(slug: string, key: string): boolean {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedKey = key.trim().toLowerCase();
  return (
    normalizedSlug === normalizedKey ||
    normalizedSlug.endsWith(`-${normalizedKey}`) ||
    normalizedKey.endsWith(`-${normalizedSlug}`)
  );
}

/** Mark blueprint nodes as created when matching child spaces exist in chat history. */
export function mergeEcosystemBlueprintWithCreatedSpaces(
  blueprint: EcosystemBlueprintEntry[],
  messages: MessageWithParts[],
): EcosystemBlueprintEntry[] {
  const createdSpaces = collectCreatedEcosystemSpaces(messages);
  if (createdSpaces.length === 0) return blueprint;

  const usedSlugs = new Set<string>();
  return blueprint.map((entry) => {
    if (entry.status === 'created') return entry;

    const byKey = createdSpaces.find(
      (space) =>
        !usedSlugs.has(space.slug) &&
        matchesBlueprintKey(space.slug, entry.key),
    );
    if (byKey) {
      usedSlugs.add(byKey.slug);
      return { ...entry, status: 'created' as const };
    }

    const byRole = entry.role
      ? createdSpaces.find(
          (space) =>
            !usedSlugs.has(space.slug) &&
            space.role === entry.role &&
            entry.role !== 'other',
        )
      : undefined;
    if (byRole) {
      usedSlugs.add(byRole.slug);
      return { ...entry, status: 'created' as const };
    }

    return entry;
  });
}

export function resolveEcosystemBlueprintForContext(
  context: OnboardingConversationContext | undefined,
  messages: MessageWithParts[],
): EcosystemBlueprintEntry[] | undefined {
  const extracted = extractEcosystemBlueprintFromMessages(messages);
  const base = extracted ?? context?.setupPlan?.ecosystemBlueprint;
  if (!base?.length) return undefined;
  return mergeEcosystemBlueprintWithCreatedSpaces(base, messages);
}

/** Sync blueprint from chat tool output into onboarding context when it changes. */
export function syncEcosystemBlueprintInContext(
  context: OnboardingConversationContext,
  messages: MessageWithParts[],
): OnboardingConversationContext | null {
  if (context.setupJourney !== 'ecosystem') return null;
  const resolved = resolveEcosystemBlueprintForContext(context, messages);
  if (!resolved?.length) return null;
  if (blueprintEntriesEqual(context.setupPlan?.ecosystemBlueprint, resolved)) {
    return null;
  }
  return {
    ...context,
    setupPlan: {
      ...context.setupPlan,
      ecosystemBlueprint: resolved,
    },
  };
}

/** Build post-root handoff context + continuation prompt for onboarding → left panel. */
export function preparePostRootOnboardingHandoff(
  context: OnboardingConversationContext,
  messages: MessageWithParts[],
  rootSlug: string,
): {
  context: OnboardingConversationContext;
  continuationPrompt?: string;
} {
  const isEcosystem = context.setupJourney === 'ecosystem';
  const blueprint = isEcosystem
    ? resolveEcosystemBlueprintForContext(context, messages)
    : undefined;
  const nextContext: OnboardingConversationContext = {
    ...context,
    source:
      context.source === ONBOARDING_HERO_SOURCE
        ? AI_PANEL_SETUP_SOURCE
        : context.source,
    setupPhase: isEcosystem ? 'execute' : 'verify',
    createdSpaceSlug: rootSlug,
    ...(isEcosystem ? { ecosystemRootSlug: rootSlug } : {}),
    ...(blueprint?.length
      ? {
          setupPlan: {
            ...context.setupPlan,
            ecosystemBlueprint: blueprint,
          },
        }
      : {}),
  };

  return {
    context: nextContext,
    continuationPrompt: getPostOnboardingContinuationPrompt(
      context.setupJourney,
      blueprint,
      rootSlug,
    ),
  };
}
