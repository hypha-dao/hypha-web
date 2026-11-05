import {
  SpaceQuestCreateDraft,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getSpaceMemberNames } from '../_space-member-names';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function NewQuestPage(props: PageProps) {
  const { id } = await props.params;
  const spaceMemberNames = await getSpaceMemberNames(id);

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="w-full min-w-0 py-4">
        <SpaceQuestCreateDraft
          spaceSlug={id}
          spaceMemberNames={spaceMemberNames}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
