import { SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { notFound } from 'next/navigation';
import { getDhoPathGovernance } from '@hypha-platform/epics';
import { IssueNewTokenForm } from '@hypha-platform/epics';
import { Plugin } from '../../../governance/create/plugins';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function IssueNewTokenPage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId } = spaceFromDb;

  return (
    <SidePanel>
      <IssueNewTokenForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={getDhoPathGovernance(lang as Locale, id)}
        plugin={<Plugin name="issue-new-token" />}
      />
    </SidePanel>
  );
}
