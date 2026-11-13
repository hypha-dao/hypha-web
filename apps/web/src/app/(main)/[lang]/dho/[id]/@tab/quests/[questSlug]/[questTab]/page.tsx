import {
  SpaceQuestDetail,
  SpaceTabAccessWrapper,
  isRetiredQuestParticipantTab,
  isSpaceQuestDetailTab,
  questDetailSearchTargetsParticipantTab,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound, redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    lang: Locale;
    id: string;
    questSlug: string;
    questTab: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuestTabPage(props: PageProps) {
  const { lang, id, questSlug, questTab } = await props.params;
  const searchParams = await props.searchParams;
  if (
    isRetiredQuestParticipantTab(questTab) ||
    questDetailSearchTargetsParticipantTab(searchParams)
  ) {
    redirect(`/${lang}/dho/${id}/quests/${encodeURIComponent(questSlug)}`);
  }
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
