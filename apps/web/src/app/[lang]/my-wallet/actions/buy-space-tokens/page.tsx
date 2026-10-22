import { getTranslations } from 'next-intl/server';
import { MyWalletBuySpaceTokensClient } from '../../_components/my-wallet-action-clients';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MyWalletBuySpaceTokensPage(props: PageProps) {
  const { lang } = await props.params;
  const t = await getTranslations('MyWallet');

  return (
    <WalletActionFrame
      lang={lang}
      backLabel={t('backToWallet')}
      title={t('shortcuts.buySpace')}
    >
      <MyWalletBuySpaceTokensClient closeUrl={`/${lang}/my-wallet`} />
    </WalletActionFrame>
  );
}
