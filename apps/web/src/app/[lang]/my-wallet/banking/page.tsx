import { MyWalletDashboard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { WalletPageFrame } from '../_components/wallet-page-frame';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function MyWalletBankingPage(props: PageProps) {
  const { lang } = await props.params;

  return (
    <WalletPageFrame lang={lang} titleKey="bankTransfers">
      <MyWalletDashboard lang={lang} section="banking" />
    </WalletPageFrame>
  );
}
