'use client';

import { useMemberExperience } from '../../../../people/components/member-experience';
import { SpaceEnergySection } from '../space-energy-section';
import {
  EnergySectionSkeleton,
  MemberEnergyBoardSkeleton,
} from './loading-skeletons';
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

/** Access / route pending mask — line board for members, bar dashboard otherwise. */
export function EnergyScreenSkeleton() {
  const { isMember } = useMemberExperience();
  if (isMember) return <MemberEnergyBoardSkeleton />;
  return <EnergySectionSkeleton />;
}
