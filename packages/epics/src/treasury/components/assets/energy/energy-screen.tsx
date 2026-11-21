'use client';

import { useMe } from '@hypha-platform/core/client';
import { isMemberOrientation } from '../../../../people/components/member-menu';
import { SpaceEnergySection } from '../space-energy-section';
import { MemberEnergyDiagram } from './member-energy-diagram';

/**
 * Members see the home energy diagram. Builders and funders keep the
 * energy dashboard, including while the profile is still loading.
 */
export function EnergyScreen({ spaceSlug }: { spaceSlug: string }) {
  const { person, isLoading } = useMe();
  if (!isLoading && isMemberOrientation(person?.primaryOrientation)) {
    return <MemberEnergyDiagram spaceSlug={spaceSlug} />;
  }
  return <SpaceEnergySection spaceSlug={spaceSlug} />;
}
