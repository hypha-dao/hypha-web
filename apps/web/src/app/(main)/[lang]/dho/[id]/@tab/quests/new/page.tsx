import {
  SpaceQuestCreateDraft,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewQuestPage(props: PageProps) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const draftParam = firstParam(searchParams.draft);
  const freshParam = firstParam(searchParams.fresh);
  const parsedDraft =
    draftParam && /^[1-9]\d*$/.test(draftParam) ? Number(draftParam) : null;
  const resumeDraftId =
    parsedDraft != null && Number.isSafeInteger(parsedDraft)
      ? parsedDraft
      : null;

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="w-full min-w-0 py-4">
        <SpaceQuestCreateDraft
          spaceSlug={id}
          resumeDraftId={resumeDraftId}
          startFresh={freshParam === '1' && resumeDraftId == null}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
