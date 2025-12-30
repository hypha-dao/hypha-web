import { CoherenceBlock } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CoherencePage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  return <CoherenceBlock lang={lang} spaceSlug={id} />;
}
