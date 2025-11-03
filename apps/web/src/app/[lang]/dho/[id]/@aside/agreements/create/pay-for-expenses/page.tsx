import { CreatePayForExpensesForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { Plugin } from '../plugins';
import { notFound } from 'next/navigation';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { fetchMembersAndSpaces } from '@web/utils/fetch-users-members';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreatePayForExpensesPage({ params }: PageProps) {
  const { lang, id } = await params;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;

  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  const { spaces, members } = await fetchMembersAndSpaces({
    activeSpaceId: spaceId,
  });

  return (
    <SidePanel>
      <CreatePayForExpensesForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_CREATE_ACTION}`}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        plugin={
          <Plugin
            name="pay-for-expenses"
            spaceSlug={spaceSlug}
            spaces={spaces}
            members={members}
          />
        }
      />
    </SidePanel>
  );
}
