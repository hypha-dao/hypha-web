import { MyWalletDashboard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { WalletPageFrame } from './_components/wallet-page-frame';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function MyWalletPage(props: PageProps) {
  const { lang } = await props.params;

  return (
    <WalletPageFrame lang={lang}>
      <MyWalletDashboard lang={lang} section="wallet" />
    </WalletPageFrame>
  );
}
