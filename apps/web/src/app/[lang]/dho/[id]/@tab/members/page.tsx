import { Locale } from '@hypha-platform/i18n';
import { MembersSection, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { useMembers } from '@web/hooks/use-members';

import { getDhoPathMembers } from './constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  const web3SpaceId = spaceFromDb?.web3SpaceId;

  const basePath = getDhoPathMembers(lang as Locale, id as string);

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId as number} spaceSlug={id}>
      <div className="flex flex-col gap-6 py-4">
        <MembersSection
          basePath={`${basePath}/person`}
          useMembers={useMembers}
          spaceSlug={id}
          refreshInterval={2000}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
