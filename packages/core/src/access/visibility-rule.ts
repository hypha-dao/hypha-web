/**
 * The four-level transparency rule for `/api/v2`, in one pure place. It is the
 * single rule behind both the access gate (`authorizeSpaceRead`, level =
 * `access`) and the viewer-aware spaces list (level = `discoverability`), so
 * the two cannot drift.
 *
 *   0 PUBLIC        anyone with an approved client key (guests included)
 *   1 NETWORK       any verified Hypha user
 *   2 ORGANISATION  "inside the organisation": direct member/delegate of the
 *                   space, OR member/delegate of a DB-organisation sibling,
 *                   OR a member of a member-space (a space whose executor is a
 *                   member of this one)
 *   3 SPACE         direct member, or delegate with a member delegator
 *
 * Member-of-a-member-space is ORGANISATION-level (read, not "inside"): it can
 * read the space but does not satisfy level 3. The Hypha UI treats it as
 * space-level (it allows interaction); v2 deliberately differs, because v2 is
 * a read surface and "may read" must not imply "is inside".
 *
 * Fail closed: an unreadable level never satisfies the rule.
 */
export type SpaceRelation = {
  /** A verified Hypha user with a wallet address made the request. */
  signedIn: boolean;
  /** Member, or delegate with a member delegator, of this space. */
  direct: boolean;
  /** Direct member/delegate of a DB-organisation sibling of this space. */
  orgSibling: boolean;
  /** Member of a space whose executor is a member of this space. */
  memberSpaceParticipant: boolean;
};

export const NO_RELATION: SpaceRelation = {
  signedIn: false,
  direct: false,
  orgSibling: false,
  memberSpaceParticipant: false,
};

export function isLevelSatisfied(
  level: number | undefined | null,
  relation: SpaceRelation,
): boolean {
  switch (level) {
    case 0:
      return true;
    case 1:
      return relation.signedIn;
    case 2:
      return (
        relation.signedIn &&
        (relation.direct ||
          relation.orgSibling ||
          relation.memberSpaceParticipant)
      );
    case 3:
      return relation.signedIn && relation.direct;
    default:
      return false;
  }
}
