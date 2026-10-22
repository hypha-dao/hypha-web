/** Same monthly price as the activate-spaces form. */
export const HYPHA_ACTIVATION_PER_MONTH = 44;

/** Paid period or trial inside this window is about to expire. Matches the space banner. */
export const SPACE_EXPIRY_SOON_DAYS = 14;

export type MemberSpacePaymentSnapshot = {
  slug: string;
  title: string;
  web3SpaceId: number;
  hasSpacePaid: boolean;
  freeTrialUsed: boolean;
  daysLeft: number;
};

export type MemberExpiringSpace = {
  slug: string;
  title: string;
  web3SpaceId: number;
  daysLeft: number;
};

/** Spaces this member can still activate with Hypha before the payment ends. */
export function memberHomeSpacesAboutToExpire(
  spaces: readonly MemberSpacePaymentSnapshot[],
): MemberExpiringSpace[] {
  return spaces
    .filter(
      (space) =>
        space.freeTrialUsed &&
        space.daysLeft > 0 &&
        space.daysLeft <= SPACE_EXPIRY_SOON_DAYS,
    )
    .sort(
      (left, right) =>
        left.daysLeft - right.daysLeft || left.title.localeCompare(right.title),
    )
    .map((space) => ({
      slug: space.slug,
      title: space.title,
      web3SpaceId: space.web3SpaceId,
      daysLeft: space.daysLeft,
    }));
}
