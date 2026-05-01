import { Locale } from '@hypha-platform/i18n';
import { MembersSection, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

import { useMembers } from '@web/hooks/use-members';

import { getDhoPathMembers } from './constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) {
    notFound();
  }
  const web3SpaceId = spaceFromDb.web3SpaceId ?? undefined;

  const basePath = getDhoPathMembers(lang as Locale, id as string);

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={id}>
      <MembersSection
        basePath={`${basePath}/person`}
        useMembers={useMembers}
        spaceSlug={id}
        refreshInterval={2000}
      />
    </SpaceTabAccessWrapper>
  );
}
