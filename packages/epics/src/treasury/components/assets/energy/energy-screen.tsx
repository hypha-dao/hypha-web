'use client';

import { useMemberExperience } from '../../../../people/components/member-experience';
import { SpaceEnergySection } from '../space-energy-section';
import { MemberEnergyDiagram } from './member-energy-diagram';

/**
 * Members see the home energy diagram. Builders and funders keep the
 * energy dashboard, including while the profile is still loading.
 */
export function EnergyScreen({ spaceSlug }: { spaceSlug: string }) {
  const { isMember } = useMemberExperience();
  if (isMember) {
    return <MemberEnergyDiagram spaceSlug={spaceSlug} />;
  }
  return <SpaceEnergySection spaceSlug={spaceSlug} />;
}
