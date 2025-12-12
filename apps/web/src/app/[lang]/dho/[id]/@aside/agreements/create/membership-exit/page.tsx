import { findSpaceBySlug } from '@hypha-platform/core/server';
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
  const successfulUrl = getDhoPathAgreements(lang, id);

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { web3SpaceId, slug: spaceSlug } = spaceFromDb;

  return (
    <SidePanel>
      <MembershipExitForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
        web3SpaceId={web3SpaceId}
      >
        <Plugin name="membership-exit" spaceSlug={spaceSlug} />
      </MembershipExitForm>
    </SidePanel>
  );
}
