import {
  CreateProposalChangeEntryMethodForm,
  SidePanel,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';
import { Plugin } from '../plugins';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import {
  findSpaceBySlug,
  getAllSpaces,
  type Space,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateChangeEntryMethodPage({
  params,
}: PageProps) {
  const { lang, id } = await params;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;
  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  let spaces = [] as Space[];
  let error = null;

  try {
    spaces = await getAllSpaces({
      parentOnly: false,
      omitSandbox: false,
    });
  } catch (err) {
    console.error('Failed to fetch spaces:', err);
    error = err instanceof Error ? err.message : 'Failed to load spaces';
  }

  const filteredSpaces = spaces?.filter(
    (space) => space?.address && space.address.trim() !== '',
  );

  return (
    <SidePanel>
      <CreateProposalChangeEntryMethodForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
        plugin={
          <Plugin
            spaceSlug={spaceSlug}
            web3SpaceId={web3SpaceId}
            name="change-entry-method"
          />
        }
        spaces={filteredSpaces}
      />
    </SidePanel>
  );
}
