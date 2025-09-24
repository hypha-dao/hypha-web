import { SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { SpaceToSpaceMembershipForm } from '@hypha-platform/epics';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import {
  getAllSpaces,
  type Space,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { Plugin } from '../plugins';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function SpaceToSpaceMembershipPage({
  params,
}: PageProps) {
  const { lang, id } = await params;
  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId } = spaceFromDb;

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
      {error ? (
        <div className="text-error text-sm">
          {error}. Please try again later.
        </div>
      ) : (
        <SpaceToSpaceMembershipForm
          successfulUrl={successfulUrl}
          backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
          spaceId={spaceId}
          web3SpaceId={web3SpaceId}
          spaces={filteredSpaces}
        >
          <Plugin
            name="space-to-space-membership"
            spaceSlug={id}
            spaces={filteredSpaces}
          />
        </SpaceToSpaceMembershipForm>
      )}
    </SidePanel>
  );
}
