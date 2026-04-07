'use client';

import { useParams } from 'next/navigation';

import {
  DelegateVotingSection,
  MemberDetail,
  MemberPageParams,
  SidePanel,
  useMemberWeb3SpaceIds,
} from '@hypha-platform/epics';
import { useIsDelegate } from '@hypha-platform/core/client';

import { useMemberBySlug } from '@web/hooks/use-member-by-slug';
import { getDhoPathMembers } from '../../../../@tab/members/constants';
import {
  useSpacesByWeb3Ids,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useMembers } from '@web/hooks/use-members';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

export default function Member() {
  const { id, lang, personSlug: personSlugRaw } = useParams<MemberPageParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const { person, isLoading: isLoadingPersons } = useMemberBySlug(personSlug);
  const { web3SpaceIds, isLoading: isLoadingSpaces } = useMemberWeb3SpaceIds({
    personAddress: person?.address,
  });
  const { spaces } = useSpacesByWeb3Ids(web3SpaceIds ?? []);
  const { space } = useSpaceBySlug(id);
  const { isDelegate } = useIsDelegate({
    spaceId: space?.web3SpaceId as number,
    userAddress: person?.address as `0x${string}`,
  });

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <MemberDetail
          closeUrl={getDhoPathMembers(lang, id)}
          member={{
            avatarUrl: person?.avatarUrl,
            name: person?.name,
            surname: person?.surname,
            nickname: person?.nickname,
            status: 'active', // TODO: get status
            about: person?.description,
            slug: person?.slug,
            address: person?.address,
          }}
          isLoading={isLoadingPersons || isLoadingSpaces}
          lang={lang}
          spaces={spaces}
        />
        {!isDelegate && (
          <DelegateVotingSection
            web3SpaceId={space?.web3SpaceId as number}
            useMembers={useMembers}
            spaceSlug={id}
          />
        )}
      </div>
    </SidePanel>
  );
}
