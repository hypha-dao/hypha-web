import { CreatePayForExpensesForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';
import { Plugin } from '../plugins';
import { notFound } from 'next/navigation';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { findSpaceBySlug, getAllSpaces } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreatePayForExpensesPage({ params }: PageProps) {
  const { lang, id } = await params;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;

  const successfulUrl = getDhoPathGovernance(lang as Locale, id);

  const spaces = await getAllSpaces();

  const filteredSpaces = spaces.filter(
    (space) => space.address && space.address.trim() !== '',
  );

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
            spaces={filteredSpaces}
          />
        }
      />
    </SidePanel>
  );
}
