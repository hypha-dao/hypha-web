import {
  SpaceQuestDetail,
  SpaceTabAccessWrapper,
  isSpaceQuestDetailTab,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';
import { getSpaceMemberNames } from '../../_space-member-names';

type PageProps = {
  params: Promise<{
    lang: Locale;
    id: string;
    questSlug: string;
    questTab: string;
  }>;
};

export default async function QuestTabPage(props: PageProps) {
  const { id, questSlug, questTab } = await props.params;
  if (!isSpaceQuestDetailTab(questTab)) {
    return notFound();
  }
  const spaceMemberNames = await getSpaceMemberNames(id);

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="w-full min-w-0 py-4">
        <SpaceQuestDetail
          spaceSlug={id}
          questSlug={decodeURIComponent(questSlug)}
          tab={questTab}
          spaceMemberNames={spaceMemberNames}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
