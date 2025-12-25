import { TransparencyLevel } from '../components/transparency-level';
import { UserSpaceState } from '../hooks/use-user-space-state';

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

export function checkAccess(
  accessLevel: TransparencyLevel | undefined,
  userState: UserSpaceState,
): boolean {
  if (accessLevel === undefined) {
    return true;
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
