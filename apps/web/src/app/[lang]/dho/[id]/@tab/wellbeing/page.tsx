import { Locale } from '@hypha-platform/i18n';
import {
  SpaceTabAccessWrapper,
  SpaceWellbeingPage,
} from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function WellbeingPage(props: PageProps) {
  const { lang, id } = await props.params;

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <SpaceWellbeingPage lang={lang} spaceSlug={id} />
    </SpaceTabAccessWrapper>
  );
}
