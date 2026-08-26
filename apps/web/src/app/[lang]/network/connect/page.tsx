import { NetworkConnectPage } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getAllSpaces, Space } from '@hypha-platform/core/server';

type PageProps = {
  params: Promise<{ lang: Locale }>;
  searchParams?: Promise<{ person?: string }>;
};

export default async function ConnectPage(props: PageProps) {
  const { lang } = await props.params;
  const searchParams = await props.searchParams;
  let spaces: Space[] = [];
  try {
    spaces = await getAllSpaces({ parentOnly: false, omitArchived: true });
  } catch (reason) {
    console.error('[network/connect] Failed to fetch spaces', reason);
  }

  return (
    <NetworkConnectPage
      lang={lang}
      spaces={spaces}
      initialPersonSlug={searchParams?.person}
    />
  );
}
