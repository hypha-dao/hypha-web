import { CoherenceBlock } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  lang: Locale;
  id: string;
};

export default async function CoherencePage({
  lang,
  id: spaceSlug,
}: PageProps) {
  return <CoherenceBlock lang={lang} spaceSlug={spaceSlug} />;
}
