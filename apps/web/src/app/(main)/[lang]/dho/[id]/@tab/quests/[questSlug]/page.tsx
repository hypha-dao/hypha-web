import { SpaceQuestDetail, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getSpaceMemberNames } from '../_space-member-names';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; questSlug: string }>;
};

export default async function QuestOverviewPage(props: PageProps) {
  const { id, questSlug } = await props.params;
  const spaceMemberNames = await getSpaceMemberNames(id);

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="w-full min-w-0 py-4">
        <SpaceQuestDetail
          spaceSlug={id}
          questSlug={decodeURIComponent(questSlug)}
          tab="overview"
          spaceMemberNames={spaceMemberNames}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
