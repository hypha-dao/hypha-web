'use client';

import { useParams } from 'next/navigation';

import {
  MemberDetail,
  SidePanel,
  useMemberWeb3SpaceIds,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

import { useMemberBySlug } from '@web/hooks/use-member-by-slug';
import { useSpaceDocuments } from '@web/hooks/use-space-documents';
import { getDhoPathMembers } from '../../../../@tab/members/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { useSpacesByWeb3Ids } from '@web/hooks/use-spaces-by-web3-ids';

export default function Member() {
  const { id, lang, personSlug } = useParams();
  const { person, isLoading: isLoadingPersons } = useMemberBySlug(
    personSlug as string,
  );
  const { web3SpaceIds, isLoading: isLoadingSpaces } = useMemberWeb3SpaceIds({
    personAddress: person?.address,
  });
  const { spaces } = useSpacesByWeb3Ids(web3SpaceIds ?? []);

  return (
    <SidePanel>
      <MemberDetail
        closeUrl={getDhoPathMembers(lang as Locale, id as string)}
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
        lang={lang as Locale}
        basePath={`${getDhoPathAgreements(
          lang as Locale,
          id as string,
        )}/agreement`}
        spaces={spaces}
        useDocuments={useSpaceDocuments}
      />
    </SidePanel>
  );
}
