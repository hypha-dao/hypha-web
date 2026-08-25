import { HomeDashboard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getAllSpaces, Space } from '@hypha-platform/core/server';
import { getEnableAiChat } from '@hypha-platform/feature-flags';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function HomePage(props: PageProps) {
  const { lang } = await props.params;
  const aiChatEnabled = await getEnableAiChat();

  let spaces: Space[] = [];
  try {
    spaces = await getAllSpaces({ parentOnly: false, omitArchived: true });
  } catch (reason) {
    console.error('[home/page] Failed to fetch spaces', reason);
  }

  return (
    <HomeDashboard lang={lang} spaces={spaces} aiChatEnabled={aiChatEnabled} />
  );
}
