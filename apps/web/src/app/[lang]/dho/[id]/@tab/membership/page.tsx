import { Locale } from '@hypha-platform/i18n';
import { MembersSection, SubspaceSection } from '@hypha-platform/epics';

import { useMembers } from '@web/hooks/use-members';

import { getDhoPathMembership } from './constants';
import { createSpaceService } from '@core/space/server';
import { getDhoPathGovernance } from '../governance/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = getDhoPathMembership(lang as Locale, id as string);

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  const subspaces = spaceFromDb.subspaces;

  const refreshInterval = 10000;

  return (
    <div className="flex flex-col gap-6 py-4">
      <SubspaceSection
        spaces={subspaces || []}
        lang={lang}
        getSpaceDetailLink={getDhoPathGovernance}
        useMembers={useMembers}
      />
      <MembersSection
        basePath={`${basePath}/person`}
        useMembers={useMembers}
        spaceSlug={spaceFromDb.slug}
        refreshInterval={refreshInterval}
      />
    </div>
  );
}
