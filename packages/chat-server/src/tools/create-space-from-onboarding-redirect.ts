export type CreateSpaceFromOnboardingRedirectInput = {
  onboarding_setup_phase?: string | null;
  onboarding_setup_journey?: 'single_space' | 'ecosystem' | null;
  onboarding_created_space_slug?: string | null;
  parent_space_slug?: string | null;
  parent_space_name?: string | null;
};

export type CreateSpaceFromOnboardingRedirectParent = {
  web3SpaceId?: number | null;
  parentId?: number | null;
} | null;

export function shouldUseCreateEcosystemSpaceInstead(
  data: CreateSpaceFromOnboardingRedirectInput,
  parentSpace?: CreateSpaceFromOnboardingRedirectParent,
): { redirect: true; reason: string } | { redirect: false } {
  const setupPhase = data.onboarding_setup_phase?.trim();
  if (setupPhase === 'execute' || setupPhase === 'verify') {
    return {
      redirect: true,
      reason:
        'The root space is already live. Use create_ecosystem_space for nested spaces under the root—confirmation only, no wallet signature.',
    };
  }

  if (data.onboarding_created_space_slug?.trim()) {
    return {
      redirect: true,
      reason:
        'Space creation already completed in this onboarding session. Use create_ecosystem_space for additional nested spaces—confirmation only, no wallet signature.',
    };
  }

  const hasParentReference = Boolean(
    data.parent_space_slug?.trim() || data.parent_space_name?.trim(),
  );
  if (
    data.onboarding_setup_journey === 'ecosystem' &&
    hasParentReference &&
    parentSpace?.web3SpaceId != null &&
    parentSpace.web3SpaceId > 0
  ) {
    return {
      redirect: true,
      reason:
        'Nested ecosystem spaces are created with create_ecosystem_space under the live root—confirmation only, no wallet signature.',
    };
  }

  return { redirect: false };
}
