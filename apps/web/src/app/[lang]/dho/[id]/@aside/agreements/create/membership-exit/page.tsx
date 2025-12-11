import {
  findSpaceBySlug,
  getAllSpaces,
  Space,
} from '@hypha-platform/core/server';
import { MembershipExitForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { db } from '@hypha-platform/storage-postgres';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { notFound } from 'next/navigation';
import { Plugin } from '../../../../_components/plugins';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipExitPage({ params }: PageProps) {
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
        <MembershipExitForm
          successfulUrl={successfulUrl}
          backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
          spaceId={spaceId}
          web3SpaceId={web3SpaceId}
          spaces={filteredSpaces}
        >
          <Plugin
            name="membership-exit"
            spaceSlug={id}
            spaces={filteredSpaces}
          />
        </MembershipExitForm>
      )}
    </SidePanel>
  );
}
