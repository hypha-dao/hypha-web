import type { SpaceScreen } from './space-screen-navigation';

/** Infer a space tab from a short context hint (mcp_navigation). */
export function inferSpaceScreenFromIntent(
  intentText: string | undefined,
): SpaceScreen | null {
  const normalized = (intentText ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (
    /\b(intelligence|artifact|artifacts|org[- ]memory|organisational intelligence|organizational intelligence)\b/.test(
      normalized,
    )
  ) {
    return 'memory';
  }
  if (
    /\b(signal|signals|coherence|alert|alerts|issue|issues|blind spot|priority)\b/.test(
      normalized,
    )
  ) {
    return 'signals';
  }
  if (
    /\b(treasury|token|tokens|vault|fund|funds|payment|payments|payout|payouts|finance)\b/.test(
      normalized,
    )
  ) {
    return 'treasury';
  }
  if (
    /\b(member|members|people|team|teams|contributor|contributors)\b/.test(
      normalized,
    )
  ) {
    return 'members';
  }
  if (/\b(reward|rewards|incentive|incentives)\b/.test(normalized)) {
    return 'rewards';
  }
  if (/\b(memory|knowledge|transcript|recording|notes)\b/.test(normalized)) {
    return 'memory';
  }
  if (/\b(config|configuration|settings|set up|setup)\b/.test(normalized)) {
    return 'space_configuration';
  }
  if (
    /\b(proposal|proposals|agreement|agreements|vote|voting|governance|document|documents)\b/.test(
      normalized,
    )
  ) {
    return 'agreements';
  }
  if (/\b(ecosystem|network|subspace|subspaces)\b/.test(normalized)) {
    return 'ecosystem_navigation';
  }
  if (/\b(overview|home|summary|dashboard)\b/.test(normalized)) {
    return 'overview';
  }
  return null;
}
