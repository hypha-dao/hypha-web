import { Locale } from '@hypha-platform/i18n';
import { SidePanel } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function BuyHyphaTokensPage({ params }: PageProps) {
  const { lang, id } = await params;

  return <SidePanel>Buy Hypha Tokens</SidePanel>;
}
