/**
 * URL segment after `/agreements/create/` (empty string for collective agreement create root).
 * Used to scope resubmit session data so one template's draft does not hydrate another.
 */
export type ResubmitProposalTemplateSegment = string;

export const RESUBMIT_PROPOSAL_DATA_KEY = 'resubmitProposalData';
export const RESUBMIT_FORM_DATA_KEY = 'resubmitFormData';
/** AI walkthrough: scroll target after prepare_governance_proposal navigation. */
export const PROPOSAL_FORM_FOCUS_KEY = 'proposalFormFocus';

/**
 * Map a human-readable proposal label to its create-route URL segment.
 *
 * @param label - The proposal label to map; may be undefined or falsy
 * @returns The corresponding URL segment (the part after `/agreements/create/`), or `''` when `label` is falsy or has no known mapping
 */
export function getCreateRouteSegmentForProposalLabel(
  label: string | undefined,
): ResubmitProposalTemplateSegment {
  if (!label) return '';

  const labelToRoute: Record<string, string> = {
    Contribution: 'propose-contribution',
    'Collective Agreement': '',
    Expenses: 'pay-for-expenses',
    Funding: 'deploy-funds',
    Airdrop: 'airdrop',
    'Voting Method': 'change-voting-method',
    'Entry Method': 'change-entry-method',
    'Issue New Token': 'issue-new-token',
    'Buy Hypha Tokens': 'buy-hypha-tokens',
    'Activate Spaces': 'activate-spaces',
    'Space To Space': 'space-to-space-membership',
    'Change Delegate': 'change-space-delegate',
    'Treasury Minting': 'mint-tokens-to-space-treasury',
    'Redeem Tokens': 'redeem-tokens',
    'Token Burning': 'token-burning',
    'Membership Exit': 'membership-exit',
    'Backing Vault': 'token-backing-vault',
    'Update Token': 'update-issued-token',
    'Token Purchase': 'space-token-purchase',
    'Space Transparency': 'space-settings-transparency',
    Investment: 'accept-investment',
    Exchange: 'exchange-stakes-and-tokens',
  };

  return labelToRoute[label] ?? '';
}

/**
 * Returns the template segment for the current URL, or null if not on a create agreement path.
 */
export function getProposalTemplateSegmentFromPathname(
  pathname: string | null | undefined,
): ResubmitProposalTemplateSegment | null {
  if (!pathname) return null;
  const marker = '/agreements/create';
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const afterMarker = pathname.slice(idx + marker.length);
  // Require `/agreements/create` as a path segment (not `/agreements/createX`).
  if (afterMarker !== '' && afterMarker[0] !== '/') return null;
  const tail = afterMarker.replace(/^\//, '');
  if (!tail) return '';
  return tail.split('/')[0] ?? '';
}

/**
 * Infers a resubmit proposal template segment from a legacy session payload.
 *
 * Examines properties commonly present in pre-scoped resubmit payloads and returns
 * the matching create-route segment string when a recognizable shape is found.
 *
 * @param parsed - The parsed session payload object to inspect for identifying fields
 * @returns A template segment string such as `"mint-tokens-to-space-treasury"`, `"change-space-delegate"`, `"space-to-space-membership"`, etc., or `undefined` if no match is found
 */
export function inferResubmitTemplateSegmentFromPayload(
  parsed: Record<string, unknown>,
): ResubmitProposalTemplateSegment | undefined {
  const explicit = parsed.resubmitTemplateSegment;
  if (typeof explicit === 'string') return explicit;

  if (parsed.mint) return 'mint-tokens-to-space-treasury';
  if (parsed.tokenBurning) return 'token-burning';
  if (
    parsed['updateIssuedTokenResubmitPayload'] &&
    typeof parsed['updateIssuedTokenResubmitPayload'] === 'object'
  ) {
    return 'update-issued-token';
  }
  if (parsed.redeemResubmit && typeof parsed.redeemResubmit === 'object') {
    return 'redeem-tokens';
  }
  if (
    parsed.spaceDiscoverability !== undefined ||
    parsed.spaceActivityAccess !== undefined
  ) {
    return 'space-settings-transparency';
  }
  if (parsed.votingMethod !== undefined || parsed.quorumAndUnity) {
    return 'change-voting-method';
  }
  if (parsed.entryMethod !== undefined || parsed.tokenBase) {
    return 'change-entry-method';
  }
  if (parsed.spaceToSpaceTargetAddress || parsed.spaceToSpaceMemberAddress) {
    return 'space-to-space-membership';
  }
  if (
    parsed.changeDelegateTargetAddress ||
    parsed.changeDelegateMemberAddress
  ) {
    return 'change-space-delegate';
  }
  if (
    parsed.issueNewTokenForm &&
    typeof parsed.issueNewTokenForm === 'object'
  ) {
    return 'issue-new-token';
  }
  if (
    parsed.tokenBackingVault &&
    typeof parsed.tokenBackingVault === 'object'
  ) {
    return 'token-backing-vault';
  }
  if (
    parsed.spaceTokenPurchaseForm &&
    typeof parsed.spaceTokenPurchaseForm === 'object'
  ) {
    return 'space-token-purchase';
  }
  if (
    parsed.buyHyphaTokensForm &&
    typeof parsed.buyHyphaTokensForm === 'object'
  ) {
    return 'buy-hypha-tokens';
  }
  if (parsed.deployFundsForm && typeof parsed.deployFundsForm === 'object') {
    return 'deploy-funds';
  }
  if (
    parsed.proposeContributionForm &&
    typeof parsed.proposeContributionForm === 'object'
  ) {
    return 'propose-contribution';
  }
  if (
    parsed.payForExpensesForm &&
    typeof parsed.payForExpensesForm === 'object'
  ) {
    return 'pay-for-expenses';
  }
  if (
    parsed.tokenAddress !== undefined ||
    parsed.activatePurchase !== undefined
  ) {
    return 'space-token-purchase';
  }

  const spaceVal = parsed.space;
  const memberVal = parsed.member;
  if (typeof spaceVal === 'number' && typeof memberVal === 'string') {
    return 'membership-exit';
  }
  if (typeof spaceVal === 'string' && typeof memberVal === 'string') {
    return 'space-to-space-membership';
  }

  return undefined;
}

/**
 * When `resubmitTemplateSegment` is absent and inference fails, only treat as a match on
 * routes that typically only use common agreement fields (legacy sessions).
 */
export function isLegacyGenericResubmitSegment(
  segment: ResubmitProposalTemplateSegment,
): boolean {
  return segment === '' || segment === 'propose-contribution';
}

export function resubmitPayloadMatchesTemplate(
  parsed: Record<string, unknown>,
  templateSegment: ResubmitProposalTemplateSegment,
): boolean {
  const storedSegment =
    typeof parsed.resubmitTemplateSegment === 'string'
      ? parsed.resubmitTemplateSegment
      : inferResubmitTemplateSegmentFromPayload(parsed);

  return (
    storedSegment === templateSegment ||
    (storedSegment === undefined &&
      isLegacyGenericResubmitSegment(templateSegment))
  );
}

/** For skip-live-sync memos: session resubmit payload targets this create route. */
export function hasResubmitDataForTemplate(
  templateSegment: ResubmitProposalTemplateSegment,
): boolean {
  return getResubmitPayloadForTemplate(templateSegment) !== null;
}

/** Parsed resubmit payload when it targets `templateSegment`, else null. */
export function getResubmitPayloadForTemplate(
  templateSegment: ResubmitProposalTemplateSegment,
): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(RESUBMIT_PROPOSAL_DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return resubmitPayloadMatchesTemplate(parsed, templateSegment)
      ? parsed
      : null;
  } catch {
    return null;
  }
}
