import {
  SpaceQuestDetail,
  SpaceTabAccessWrapper,
  isSpaceQuestDetailTab,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';

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

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="w-full min-w-0 py-4">
        <SpaceQuestDetail
          spaceSlug={id}
          questSlug={decodeURIComponent(questSlug)}
          tab={questTab}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
