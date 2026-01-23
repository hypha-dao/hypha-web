import {
  CreateProposalChangeSpaceTransparencySettingsForm,
  SidePanel,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';
import { Plugin } from '../../../../_components/plugins';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateSpaceTransparencySettingsPage({
  params,
}: PageProps) {
  const { lang, id } = await params;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;

  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  return (
    <SidePanel>
      <CreateProposalChangeSpaceTransparencySettingsForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
        plugin={
          <Plugin
            spaceSlug={spaceSlug}
            web3SpaceId={web3SpaceId}
            name="space-transparency-settings"
          />
        }
      />
    </SidePanel>
  );
}
