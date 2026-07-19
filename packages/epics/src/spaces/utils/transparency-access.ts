import { TransparencyLevel } from '../components/transparency-level';
import { UserSpaceState } from '../hooks/use-user-space-state.web3.rpc';

export function checkDiscoverability(
  discoverabilityLevel: TransparencyLevel | undefined,
  userState: UserSpaceState,
): boolean {
  if (discoverabilityLevel === undefined) {
    return true;
  }

  switch (userState) {
    case UserSpaceState.NOT_LOGGED_IN:
      return discoverabilityLevel === TransparencyLevel.PUBLIC;

    case UserSpaceState.LOGGED_IN:
      return (
        discoverabilityLevel === TransparencyLevel.PUBLIC ||
        discoverabilityLevel === TransparencyLevel.NETWORK
      );

    case UserSpaceState.LOGGED_IN_ORG:
      return (
        discoverabilityLevel === TransparencyLevel.PUBLIC ||
        discoverabilityLevel === TransparencyLevel.NETWORK ||
        discoverabilityLevel === TransparencyLevel.ORGANISATION
      );

    case UserSpaceState.LOGGED_IN_SPACE:
      return true;

    default:
      return false;
  }
}

/** Write/interact gates (chat composer, AI prompts) — members and delegates only. */
export function canInteractInSpace(userState: UserSpaceState): boolean {
  return userState === UserSpaceState.LOGGED_IN_SPACE;
}

export function checkAccess(
  accessLevel: TransparencyLevel | undefined,
  userState: UserSpaceState,
): boolean {
  // Fail closed: unknown activity access must not render gated content.
  // Callers should wait on discoverability loading before treating this as a
  // final deny (e.g. SpaceTabAccessWrapper shows a skeleton while pending).
  if (accessLevel === undefined) {
    return false;
  }

  switch (userState) {
    case UserSpaceState.NOT_LOGGED_IN:
      return accessLevel === TransparencyLevel.PUBLIC;

    case UserSpaceState.LOGGED_IN:
      return (
        accessLevel === TransparencyLevel.PUBLIC ||
        accessLevel === TransparencyLevel.NETWORK
      );

    case UserSpaceState.LOGGED_IN_ORG:
      return (
        accessLevel === TransparencyLevel.PUBLIC ||
        accessLevel === TransparencyLevel.NETWORK ||
        accessLevel === TransparencyLevel.ORGANISATION
      );

    case UserSpaceState.LOGGED_IN_SPACE:
      return true;

    default:
      return false;
  }
}
