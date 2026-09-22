import { HomeDashboard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getAllSpaces, Space } from '@hypha-platform/core/server';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function HomePage(props: PageProps) {
  const { lang } = await props.params;

  let spaces: Space[] = [];
  try {
    spaces = await getAllSpaces({ parentOnly: false, omitArchived: true });
  } catch (reason) {
    console.error('[home/page] Failed to fetch spaces', reason);
  }

  return <HomeDashboard lang={lang} spaces={spaces} />;
}
