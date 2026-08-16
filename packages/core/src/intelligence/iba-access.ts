/** IBA (space API key) write rules shared by HTTP, MCP, and core writes. */

export const IBA_CANNOT_PUBLISH =
  'Intelligence API keys cannot publish; create a draft instead.';

export const IBA_CANNOT_SHA_UPDATE_ON_CREATE =
  'Intelligence API keys cannot update published artifacts. Create a draft, or propose a patch from a signal.';

export const IBA_CANNOT_APPROVE_PATCH =
  'Intelligence API keys cannot approve or reject patches; a space member must do that.';

export function ibaWriteDeniesPublish(input: {
  skipMembershipCheck?: boolean;
  promoteDraft?: boolean;
}): boolean {
  return Boolean(input.skipMembershipCheck && input.promoteDraft);
}

export function ibaHttpCreateDenial(input: {
  mode?: string;
  expectedSha?: string;
  expected_sha?: string;
  claimedSourceApp?: string;
  keySource: string;
}): string | null {
  if (input.mode === 'publish') return IBA_CANNOT_PUBLISH;
  if (input.expectedSha?.trim() || input.expected_sha?.trim()) {
    return IBA_CANNOT_SHA_UPDATE_ON_CREATE;
  }
  const claimed = input.claimedSourceApp?.trim();
  if (claimed && claimed !== input.keySource) {
    return `source_app "${claimed}" does not match authenticated app identity "${input.keySource}".`;
  }
  return null;
}

/** IBA keys may propose a patch; approve/reject stay member-only. */
export function ibaPatchActionDenied(
  action: string | undefined,
): string | null {
  const resolved = action ?? 'propose';
  if (resolved !== 'propose') {
    return IBA_CANNOT_APPROVE_PATCH;
  }
  return null;
}
