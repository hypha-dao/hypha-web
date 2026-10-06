import {
  EPARTS_TOKEN_ADDRESS,
  HYPHA_TOKEN_ADDRESS,
} from '../common/web3/tokens';

/** Hypha Energy home space (EPARTS issuer). */
export const HYPHA_ENERGY_SPACE_ID = 658;
/** Hypha Energy Capital BV. */
export const HYPHA_ENERGY_CAPITAL_SPACE_ID = 562;
/** Hypha Energy General Assembly. */
export const HYPHA_ENERGY_GENERAL_ASSEMBLY_SPACE_ID = 1041;

const HYPHA_ENERGY_EPARTS_SPACE_IDS: ReadonlySet<number> = new Set([
  HYPHA_ENERGY_SPACE_ID,
  HYPHA_ENERGY_CAPITAL_SPACE_ID,
  HYPHA_ENERGY_GENERAL_ASSEMBLY_SPACE_ID,
]);

export type SpaceIdentity = {
  spaceSlug: string;
  spaceTitle: string;
  spaceId?: number | null;
  parentId?: number | null;
};

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * HYPHA is issued by the platform, not by each Hypha-branded space, but it is
 * the shared utility token those spaces already show on Distribution.
 */
export function shouldIncludeHyphaSharedToken(input: SpaceIdentity): boolean {
  const slug = normalizeIdentity(input.spaceSlug);
  const title = normalizeIdentity(input.spaceTitle);
  return (
    slug === 'hypha' ||
    slug.startsWith('hypha-') ||
    title === 'hypha' ||
    title.startsWith('hypha ')
  );
}

/**
 * EPARTS is issued by Hypha Energy (space 658) and used for ownership / voting
 * in Capital BV (562) and the General Assembly (1041). Match canonical ids,
 * a parent of Hypha Energy, or the `hypha-energy` / `hypha-energy-*` slugs —
 * not a free-form title prefix.
 */
export function shouldIncludeHyphaEnergyOwnershipToken(
  input: SpaceIdentity,
): boolean {
  if (
    input.spaceId != null &&
    HYPHA_ENERGY_EPARTS_SPACE_IDS.has(input.spaceId)
  ) {
    return true;
  }
  if (input.parentId === HYPHA_ENERGY_SPACE_ID) {
    return true;
  }
  const slug = normalizeIdentity(input.spaceSlug);
  return slug === 'hypha-energy' || slug.startsWith('hypha-energy-');
}

/** Parent ownership tokens are visible only when the caller can see the parent. */
export function shouldIncludeParentOwnershipTokens(
  parentAccess: { hasAccess: boolean } | null,
): boolean {
  return parentAccess?.hasAccess === true;
}

/**
 * Tokens that should appear on a space's Distribution tab even when they were
 * not minted by that space. Addresses are checksummed catalogue constants;
 * callers should lowercase before comparing on-chain values.
 */
export function extraSharedDistributionTokenAddresses(
  input: SpaceIdentity,
): readonly `0x${string}`[] {
  const addresses: `0x${string}`[] = [];
  if (shouldIncludeHyphaSharedToken(input)) {
    addresses.push(HYPHA_TOKEN_ADDRESS);
  }
  if (shouldIncludeHyphaEnergyOwnershipToken(input)) {
    addresses.push(EPARTS_TOKEN_ADDRESS);
  }
  return addresses;
}
