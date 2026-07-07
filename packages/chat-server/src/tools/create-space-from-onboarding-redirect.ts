export type CreateSpaceFromOnboardingRedirectInput = {
  onboarding_setup_phase?: string | null;
  onboarding_created_space_slug?: string | null;
  parent_space_slug?: string | null;
  parent_space_name?: string | null;
  slug?: string | null;
};

/** Block only a duplicate root create — nested on-chain spaces stay on create_space_from_onboarding. */
export function shouldBlockDuplicateRootSpaceCreation(
  data: CreateSpaceFromOnboardingRedirectInput,
  parentSpace?: { id?: number | null } | null,
  normalizedSlug?: string | null,
): { block: true; reason: string } | { block: false } {
  const hasParentReference = Boolean(
    parentSpace?.id != null ||
      data.parent_space_slug?.trim() ||
      data.parent_space_name?.trim(),
  );
  if (hasParentReference) {
    return { block: false };
  }

  const createdRootSlug = data.onboarding_created_space_slug?.trim();
  const setupPhase = data.onboarding_setup_phase?.trim();
  const isPostRootPhase = setupPhase === 'execute' || setupPhase === 'verify';
  const slug = normalizedSlug?.trim();

  if (
    createdRootSlug &&
    slug &&
    slug === createdRootSlug &&
    !hasParentReference
  ) {
    return {
      block: true,
      reason: `Root space "${createdRootSlug}" was already created in this session.`,
    };
  }

  if (isPostRootPhase || createdRootSlug) {
    return {
      block: true,
      reason:
        'The root space is already live in this onboarding session. Use create_space_from_onboarding with parent_space_slug set to the root slug to create each nested on-chain space.',
    };
  }

  return { block: false };
}
