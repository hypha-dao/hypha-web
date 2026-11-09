import {
  SpaceQuestDetail,
  SpaceTabAccessWrapper,
  questDetailSearchTargetsParticipantTab,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; questSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuestOverviewPage(props: PageProps) {
  const { lang, id, questSlug } = await props.params;
  const searchParams = await props.searchParams;
  if (questDetailSearchTargetsParticipantTab(searchParams)) {
    redirect(`/${lang}/dho/${id}/quests/${encodeURIComponent(questSlug)}`);
  }

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="w-full min-w-0 py-4">
        <SpaceQuestDetail
          spaceSlug={id}
          questSlug={decodeURIComponent(questSlug)}
          tab="overview"
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
