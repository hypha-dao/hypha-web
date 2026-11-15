'use client';

import { useParams } from 'next/navigation';
import {
  MemberDetail,
  MemberPageParams,
  ProposalOverlayShell,
  useMemberWeb3SpaceIds,
} from '@hypha-platform/epics';
import { useSpacesByWeb3Ids } from '@hypha-platform/core/client';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

import { useMemberBySlug } from '@web/hooks/use-member-by-slug';
import { useWhiteLabelSectionHref } from '@web/components/white-label/white-label-provider';
import { PERSON_OVERLAY_CLASS } from './person-overlay-class';

/**
 * Person detail on a white-label tree: the shared `MemberDetail` in the overlay
 * shell, read-only. No call, video or chat buttons and no delegate-voting
 * section (a write); the person API answers for members of this Space only.
 */
export function PersonOverlay() {
  const { lang, personSlug: personSlugRaw } = useParams<MemberPageParams>();
  const sectionHref = useWhiteLabelSectionHref();
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const { person, isLoading: isLoadingPerson } = useMemberBySlug(personSlug);
  const { web3SpaceIds, isLoading: isLoadingSpaces } = useMemberWeb3SpaceIds({
    personAddress: person?.address,
  });
  const { spaces } = useSpacesByWeb3Ids(web3SpaceIds ?? []);

  return (
    <ProposalOverlayShell className={PERSON_OVERLAY_CLASS}>
      <MemberDetail
        hideConnect
        closeUrl={sectionHref('members')}
        member={{
          id: person?.id,
          avatarUrl: person?.avatarUrl,
          name: person?.name,
          surname: person?.surname,
          nickname: person?.nickname,
          status: 'active',
          about: person?.description,
          slug: person?.slug,
          address: person?.address,
        }}
        isLoading={isLoadingPerson || isLoadingSpaces}
        lang={lang}
        spaces={spaces}
      />
    </ProposalOverlayShell>
  );
}
