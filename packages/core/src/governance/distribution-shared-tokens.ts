import {
  EPARTS_TOKEN_ADDRESS,
  HYPHA_TOKEN_ADDRESS,
} from '../common/web3/tokens';

export type SpaceIdentity = {
  spaceSlug: string;
  spaceTitle: string;
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
 * EPARTS is issued by Hypha Energy (home space) and used for ownership / voting
 * in sibling spaces such as Capital BV and the General Assembly.
 */
export function shouldIncludeHyphaEnergyOwnershipToken(
  input: SpaceIdentity,
): boolean {
  const slug = normalizeIdentity(input.spaceSlug);
  const title = normalizeIdentity(input.spaceTitle);
  return (
    slug === 'hypha-energy' ||
    slug.startsWith('hypha-energy-') ||
    title === 'hypha energy' ||
    title.startsWith('hypha energy ')
  );
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
