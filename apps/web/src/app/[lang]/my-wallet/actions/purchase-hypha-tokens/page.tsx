import { getAllSpaces, Space } from '@hypha-platform/core/server';
import { getTranslations } from 'next-intl/server';
import { MyWalletPurchaseHyphaTokensClient } from '../../_components/my-wallet-action-clients';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MyWalletPurchaseHyphaTokensPage(
  props: PageProps,
) {
  const { lang } = await props.params;
  const t = await getTranslations('MyWallet');
  const tActions = await getTranslations('ProfileActions');
  const tModalAside = await getTranslations('ModalAside');

  let spaces = [] as Space[];
  let hasError = false;

  try {
    spaces = await getAllSpaces({
      parentOnly: false,
      omitSandbox: false,
    });
  } catch (err) {
    console.error('Failed to fetch spaces:', err);
    hasError = true;
  }

  const filteredSpaces = spaces?.filter(
    (space) => space?.address && space.address.trim() !== '',
  );

  return (
    <WalletActionFrame
      lang={lang}
      backLabel={t('backToWallet')}
      title={tModalAside('buyHyphaTokens')}
    >
      <span className="text-2 text-neutral-11">
        {tActions('purchaseHypha.content')}
      </span>
      {hasError ? (
        <div className="text-error text-sm">
          {tActions('errors.loadSpaces')}
        </div>
      ) : (
        <MyWalletPurchaseHyphaTokensClient
          spaces={filteredSpaces}
          closePanelUrl={`/${lang}/my-wallet`}
        />
      )}
    </WalletActionFrame>
  );
}
