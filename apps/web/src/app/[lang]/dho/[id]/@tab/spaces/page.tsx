import { SpaceNavigationView } from '../../_components/space-navigation-view';
import { Locale } from '@hypha-platform/i18n';
import { DhoTabPage } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ id: string; lang: Locale }>;
};

export default async function DhoSpacesPage(props: PageProps) {
  const { id, lang } = await props.params;

  return (
    <DhoTabPage>
      <SpaceNavigationView lang={lang} daoSlug={id} />
    </DhoTabPage>
  );
}
