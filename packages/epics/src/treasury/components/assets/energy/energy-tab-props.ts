import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import type { EnergyPeopleMap } from './use-energy-people';

export type EnergyTabProps = {
  data: SpaceEnergyResponse;
  people: EnergyPeopleMap;
  peopleLoading: boolean;
};

export const energyAvatarLoading = (
  address: string,
  peopleLoading: boolean,
  participantProfiles?: SpaceEnergyResponse['participantProfiles'],
) =>
  peopleLoading &&
  !participantProfiles?.[address.toLowerCase()]?.displayName;
