import { MyWalletDashboard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { WalletPageFrame } from '../_components/wallet-page-frame';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function MyWalletAssetsPage(props: PageProps) {
  const { lang } = await props.params;

  return (
    <WalletPageFrame lang={lang}>
      <MyWalletDashboard lang={lang} section="assets" />
    </WalletPageFrame>
  );
}
