import { SpaceNavigationView } from '../../_components/space-navigation-view';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ id: string; lang: Locale }>;
};

export default async function DhoSpacesPage(props: PageProps) {
  const { id, lang } = await props.params;

  return (
    <div className="w-full min-w-0 py-4">
      <SpaceNavigationView lang={lang} daoSlug={id} />
    </div>
  );
}
