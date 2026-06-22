import type { ChatRequestPayload } from './request-schema';

type EcosystemBlueprintEntry = {
  key: string;
  role: string;
  title: string;
  status: 'planned' | 'confirmed' | 'created';
};

/** Server-side prompt block for post-root ecosystem child space creation. */
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
    '- Execute phase (ecosystem): the root space is live. Do not restart discovery, re-ask journey, or call create_space_from_onboarding for the root again.',
    rootSlug
      ? `- Use parent_space_slug "${rootSlug}" for every create_ecosystem_space call.`
      : '- Use the ecosystem root slug as parent_space_slug for create_ecosystem_space.',
  ];

  if (pending.length > 0) {
    const lines = pending
      .slice(0, 10)
      .map(
        (entry, index) =>
          `${index + 1}. ${entry.title} (${entry.role.replace(/_/g, ' ')})`,
      )
      .join('\n');
    parts.push(
      `- Pending blueprint child spaces from onboarding:\n${lines}`,
      '- Present the first pending space, get explicit confirmation, then create it with create_ecosystem_space. Continue one by one until the blueprint is complete.',
    );
  } else {
    parts.push(
      '- Propose 3–4 child spaces from the onboarding conversation (roles + purpose), then create each with create_ecosystem_space after confirmation.',
    );
  }

  return parts.join('\n');
}
