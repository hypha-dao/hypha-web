import { CreateAirdropForm, ProposalOverlayShell } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { Plugin } from '../../../../_components/plugins';
import { notFound } from 'next/navigation';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import {
  findSpaceBySlug,
  findPeopleBySpaceSlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { fetchMembersAndSpaces } from '@web/utils/fetch-users-members';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateAirdropPage({ params }: PageProps) {
  const { lang, id } = await params;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;

  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  const { spaces, members } = await fetchMembersAndSpaces({
    activeSpaceId: spaceId,
  });

  // Recipient dropdown lists every Hypha network member, but members of this
  // space should surface at the top of the list.
  const spaceMembers = await findPeopleBySpaceSlug(
    { spaceSlug },
    { db, pagination: { page: 1, pageSize: 1000 } },
  );
  const spaceMemberAddresses = new Set(
    spaceMembers.data
      .map((member) => member.address?.toLowerCase())
      .filter((address): address is string => Boolean(address)),
  );
  const orderedMembers = [...members].sort((a, b) => {
    const aIsSpaceMember = spaceMemberAddresses.has(
      a.address?.toLowerCase() ?? '',
    );
    const bIsSpaceMember = spaceMemberAddresses.has(
      b.address?.toLowerCase() ?? '',
    );
    if (aIsSpaceMember === bIsSpaceMember) return 0;
    return aIsSpaceMember ? -1 : 1;
  });

  return (
    <ProposalOverlayShell>
      <CreateAirdropForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_CREATE_ACTION}`}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        plugin={
          <Plugin
            name="airdrop"
            spaceSlug={spaceSlug}
            spaces={spaces}
            members={orderedMembers}
          />
        }
      />
    </ProposalOverlayShell>
  );
}
