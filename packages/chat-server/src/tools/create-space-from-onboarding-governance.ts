export type OnboardingGovernanceLevel = 0 | 1 | 2 | 3;

export type CreateSpaceGovernanceInput = {
  parent_space_slug?: string | null;
  parent_space_name?: string | null;
  discoverability?: number | null;
  access?: number | null;
  join_method?: number | null;
};

export type MissingOnboardingGovernanceField =
  | 'transparency_discoverability'
  | 'transparency_activity_access'
  | 'entry_method';

export type CreateSpaceGovernanceGateResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      missing_fields: MissingOnboardingGovernanceField[];
      requires_transparency_picker: boolean;
      requires_entry_method_picker: boolean;
      next_step: string;
    };

function isTransparencyLevel(
  value: unknown,
): value is OnboardingGovernanceLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 3
  );
}

function isJoinMethod(value: unknown): value is OnboardingGovernanceLevel {
  return isTransparencyLevel(value);
}

/** Nested creates under a parent skip the root onboarding governance gate. */
export function isNestedOnboardingSpaceCreate(
  input: Pick<
    CreateSpaceGovernanceInput,
    'parent_space_slug' | 'parent_space_name'
  >,
): boolean {
  return Boolean(
    input.parent_space_slug?.trim() || input.parent_space_name?.trim(),
  );
}

/**
 * Root space creation must include Space Transparency (discoverability +
 * activity access) and entry/join method — from UI cards or explicit args.
 */
export function validateCreateSpaceGovernanceSettings(
  input: CreateSpaceGovernanceInput,
): CreateSpaceGovernanceGateResult {
  if (isNestedOnboardingSpaceCreate(input)) {
    return { ok: true };
  }

  const missing: MissingOnboardingGovernanceField[] = [];
  if (!isTransparencyLevel(input.discoverability)) {
    missing.push('transparency_discoverability');
  }
  if (!isTransparencyLevel(input.access)) {
    missing.push('transparency_activity_access');
  }
  if (!isJoinMethod(input.join_method)) {
    missing.push('entry_method');
  }

  if (missing.length === 0) {
    return { ok: true };
  }

  const needsTransparency =
    missing.includes('transparency_discoverability') ||
    missing.includes('transparency_activity_access');
  const needsEntry = missing.includes('entry_method');

  const parts: string[] = [];
  if (needsTransparency) {
    parts.push(
      'Space Transparency (discoverability and activity access via the transparency card)',
    );
  }
  if (needsEntry) {
    parts.push('entry method (via the entry method card)');
  }

  return {
    ok: false,
    error: `Cannot create the space yet — still need ${parts.join(
      ' and ',
    )}. Call onboarding_guidance, ask the next unanswered question, and wait for the user to choose with the on-screen card (or say their choice in chat) before calling create_space_from_onboarding again.`,
    missing_fields: missing,
    requires_transparency_picker: needsTransparency,
    requires_entry_method_picker: needsEntry,
    next_step:
      'Do not invent defaults. Collect the missing settings with onboarding_guidance and the UI cards, then retry create_space_from_onboarding with discoverability, access, and join_method set.',
  };
}
