import { SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { notFound } from 'next/navigation';
import { getDhoPathTreasury } from '../../../../@tab/treasury/constants';
import { IssueNewTokenForm } from '@hypha-platform/epics';
import { Plugin } from '../../../governance/create/plugins';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function IssueNewTokenPage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId } = spaceFromDb;

  const successfulUrl = getDhoPathTreasury(lang as Locale, id);

  return (
    <SidePanel>
      <IssueNewTokenForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
        plugin={<Plugin name="issue-new-token" />}
      />
    </SidePanel>
  );
}
