import { SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';
import { IssueNewTokenForm } from '@hypha-platform/epics';
import { Plugin } from '../plugins';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams: Promise<{ back?: string; backMenu?: string }>;
};

export default async function IssueNewTokenPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, id } = await params;
  const { back = '', backMenu = '' } = await searchParams;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId } = spaceFromDb;

  const successfulUrl = back ? back : getDhoPathAgreements(lang as Locale, id);
  const backUrl = back
    ? backMenu
    : `${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`;

  return (
    <SidePanel>
      <IssueNewTokenForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={successfulUrl}
        backUrl={backUrl}
        plugin={<Plugin name="issue-new-token" />}
      />
    </SidePanel>
  );
}
