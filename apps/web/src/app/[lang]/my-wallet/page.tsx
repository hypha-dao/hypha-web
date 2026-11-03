import { MyWalletDashboard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { WalletPageFrame } from './_components/wallet-page-frame';

type PageProps = {
  params: Promise<{ lang: Locale }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function MyWalletPage(props: PageProps) {
  const { lang } = await props.params;
  const searchParams = await props.searchParams;

  return (
    <WalletPageFrame lang={lang} titleKey="allYourAssets">
      <MyWalletDashboard
        lang={lang}
        section="wallet"
        tokenFilter={firstQueryValue(searchParams.token)}
      />
    </WalletPageFrame>
  );
}
