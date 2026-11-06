import {
  SpaceContextSection,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function ContextPage(props: PageProps) {
  const { id } = await props.params;

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="craft-page-canvas flex w-full min-w-0 flex-col gap-4 py-4">
        <SpaceContextSection spaceSlug={id} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
