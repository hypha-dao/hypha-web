import type { OnboardingConversationContext } from './ai-onboarding-context';

const ONBOARDING_SETUP_MODE = 'onboarding_setup' as const;

/** Fields required to decide whether onboarding context attaches to a space route. */
export type OnboardingContextAttachInput = Pick<
  OnboardingConversationContext,
  | 'mode'
  | 'setupPhase'
  | 'setupJourney'
  | 'createdSpaceSlug'
  | 'ecosystemRootSlug'
  | 'setupPlan'
>;

function normalizeSlug(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function slugMatchesBlueprintEntry(
  activeSlug: string,
  blueprintKey: string,
): boolean {
  const active = activeSlug.toLowerCase();
  const key = blueprintKey.toLowerCase();
  return (
    active === key || active.endsWith(`-${key}`) || key.endsWith(`-${active}`)
  );
}

/** Whether onboarding context should ride along on chat requests for this space. */
export function shouldAttachOnboardingContext(
  context: OnboardingContextAttachInput | undefined,
  options: {
    spaceSlug?: string;
    isOnboardingPath?: boolean;
  },
): context is OnboardingContextAttachInput {
  if (!context || context.mode !== ONBOARDING_SETUP_MODE) return false;
  if (options.isOnboardingPath) return true;

  const phase = context.setupPhase ?? 'discover';
  const activeSlug = normalizeSlug(options.spaceSlug);

  if (phase === 'discover' || phase === 'draft' || phase === 'confirm') {
    return !activeSlug;
  }

  if (phase === 'execute' || phase === 'verify') {
    const anchorSlug = normalizeSlug(
      context.createdSpaceSlug ?? context.ecosystemRootSlug,
    );
    if (!anchorSlug) {
      return false;
    }
    if (!activeSlug) return true;

    if (activeSlug === anchorSlug) return true;

    if (phase === 'execute' && context.setupJourney === 'ecosystem') {
      const blueprint = context.setupPlan?.ecosystemBlueprint ?? [];
      if (
        blueprint.some((entry) =>
          slugMatchesBlueprintEntry(activeSlug, entry.key),
        )
      ) {
        return true;
      }
      return (
        activeSlug.startsWith(`${anchorSlug}-`) ||
        activeSlug.startsWith(`${anchorSlug}_`)
      );
    }

    return false;
  }

  return false;
}

/** Pre-create onboarding only — skip space membership/subscription gates in the UI. */
export function shouldBypassSpaceMembershipForOnboarding(
  context: OnboardingContextAttachInput | undefined,
  options: {
    spaceSlug?: string;
    isOnboardingPath?: boolean;
  },
): boolean {
  if (!context || context.mode !== ONBOARDING_SETUP_MODE) return false;
  if (options.isOnboardingPath) return true;

  const phase = context.setupPhase ?? 'discover';
  if (phase !== 'discover' && phase !== 'draft' && phase !== 'confirm') {
    return false;
  }

  return !normalizeSlug(options.spaceSlug);
}
