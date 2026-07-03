import type { ChatRequestPayload } from './request-schema';

type EcosystemBlueprintEntry = {
  key: string;
  role: string;
  title: string;
  status: 'planned' | 'confirmed' | 'created';
};

export function hasPendingEcosystemChildSpaces(
  context: ChatRequestPayload['conversationContext'],
): boolean {
  if (context?.setupJourney !== 'ecosystem') return false;
  if (context.setupPhase !== 'execute' && context.setupPhase !== 'verify') {
    return false;
  }
  const blueprint = context.setupPlan?.ecosystemBlueprint as
    | EcosystemBlueprintEntry[]
    | undefined;
  if (!blueprint?.length) {
    return context.setupPhase === 'execute';
  }
  return blueprint.some((entry) => entry.status !== 'created');
}

/** Server-side prompt block for left-panel nested space creation after root exists. */
export function buildEcosystemExecutePhaseDirective(
  context: ChatRequestPayload['conversationContext'],
): string | null {
  if (
    context?.mode !== 'onboarding_setup' ||
    context.setupPhase !== 'execute' ||
    context.setupJourney !== 'ecosystem'
  ) {
    return null;
  }

  const rootSlug =
    context.ecosystemRootSlug?.trim() || context.createdSpaceSlug?.trim();
  const blueprint = context.setupPlan?.ecosystemBlueprint as
    | EcosystemBlueprintEntry[]
    | undefined;
  const pending =
    blueprint?.filter((entry) => entry.status !== 'created') ?? [];

  const parts = [
    '- Left panel execute phase (ecosystem): the root space is live. Nested spaces from the onboarding blueprint are the mandatory next step—do not skip or apologize for missing them. User-facing term: nested spaces only—never subspace or subspaces.',
    '- Do NOT ask about voting method, entry method, signals, or member-gated tools until nested spaces are created—or the user explicitly defers for later.',
    '- Do not restart discovery, re-ask journey, or call create_space_from_onboarding for the root again.',
    '- create_ecosystem_space never requires wallet signing—after the user confirms, call it without dry_run in the same turn. Never ask the user to sign their wallet for nested spaces.',
    rootSlug
      ? `- Use parent_space_slug "${rootSlug}" for every create_ecosystem_space call.`
      : '- Use the ecosystem root slug as parent_space_slug for create_ecosystem_space.',
    '- ONE nested space per turn: propose name, role, and purpose in warm prose, get reaction, then create_ecosystem_space. Never dump a numbered list of all pending spaces.',
  ];

  if (pending.length > 0) {
    const first = pending[0]!;
    parts.push(
      `- First pending nested space from onboarding handover: "${
        first.title
      }" (${first.role.replace(/_/g, ' ')}).`,
      `- ${pending.length} nested space(s) remain after the first. Continue one by one in the left panel until the blueprint is complete.`,
    );
  } else {
    parts.push(
      '- No saved blueprint—infer nested spaces from the onboarding conversation, propose the first one now, then create each with create_ecosystem_space after confirmation.',
    );
  }

  return parts.join('\n');
}
