import { Locale } from '@hypha-platform/i18n';
import { SidePanel, ActivateSpacesFormSpace } from '@hypha-platform/epics';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import {
  getAllSpaces,
  type Space,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { Plugin } from '../../../../_components/plugins';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function ActivateSpacesPage({ params }: PageProps) {
  const { lang, id } = await params;
  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;

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
        <ActivateSpacesFormSpace
          successfulUrl={successfulUrl}
          backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
          spaceId={spaceId}
          web3SpaceId={web3SpaceId}
        >
          <Plugin
            name="activate-spaces"
            spaceSlug={spaceSlug}
            spaces={filteredSpaces}
          />
        </ActivateSpacesFormSpace>
      )}
    </SidePanel>
  );
}
