import { SidePanel, TokenBurningForm } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { Plugin } from '../../../../_components/plugins';
import { fetchMembersAndSpaces } from '@web/utils/fetch-users-members';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
  searchParams: Promise<{ hideBack?: string }>;
};

export default async function TokenBurningPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, id, tab } = await params;
  const { hideBack = 'false' } = await searchParams;
  const hideBackUrl = hideBack?.toLowerCase?.() === 'true';

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId, slug } = spaceFromDb;

  const successfulUrl = getDhoPathAgreements(lang, id);
  const closeUrl = `/${lang}/dho/${id}/${tab}`;
  const backUrl = hideBackUrl
    ? undefined
    : `${closeUrl}${PATH_SELECT_SETTINGS_ACTION}`;

  const { spaces, members } = await fetchMembersAndSpaces({
    activeSpaceId: spaceId,
  });
  const spacesForTokenBurning =
    spaceFromDb.address && spaceFromDb.address.trim() !== ''
      ? [spaceFromDb, ...spaces.filter((space) => space.id !== spaceFromDb.id)]
      : spaces;

  return (
    <SidePanel>
      <TokenBurningForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={successfulUrl}
        backUrl={backUrl}
        closeUrl={closeUrl}
        plugin={
          <Plugin
            name="token-burning"
            spaceSlug={slug}
            spaces={spacesForTokenBurning}
            members={members}
          />
        }
      />
    </SidePanel>
  );
}
