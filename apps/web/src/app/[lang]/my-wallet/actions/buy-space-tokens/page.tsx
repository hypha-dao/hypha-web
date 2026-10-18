import { getTranslations } from 'next-intl/server';
import { MyWalletBuySpaceTokensClient } from '../../_components/my-wallet-action-clients';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MyWalletBuySpaceTokensPage(props: PageProps) {
  const { lang } = await props.params;
  const t = await getTranslations('MyWallet');
  const tActions = await getTranslations({
    locale: lang,
    namespace: 'ProfileActions',
  });
  const tModalAside = await getTranslations('ModalAside');

  return (
    <WalletActionFrame
      lang={lang}
      backLabel={t('backToWallet')}
      title={tModalAside('buySpaceTokens')}
    >
      <span className="text-2 text-neutral-11">
        {tActions('actions.buySpaceTokens.description')}
      </span>
      <MyWalletBuySpaceTokensClient closeUrl={`/${lang}/my-wallet`} />
    </WalletActionFrame>
  );
}
