import {
  findSpaceByAddress,
  mapDbSpaceToSpace,
  type Space,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getTranslations } from 'next-intl/server';
import { MyWalletPurchaseHyphaTokensClient } from '../../_components/my-wallet-action-clients';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

/** USDC paid to this space. The form only needs its name, not the network. */
const HYPHA_USDC_RECIPIENT = '0x3dEf11d005F8C85c93e3374B28fcC69B25a650Af';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MyWalletPurchaseHyphaTokensPage(
  props: PageProps,
) {
  const { lang } = await props.params;
  const t = await getTranslations('MyWallet');

  let spaces: Space[] = [];
  try {
    const row = await findSpaceByAddress(
      { address: HYPHA_USDC_RECIPIENT },
      { db },
    );
    if (row?.address?.trim()) {
      spaces = [
        {
          ...(mapDbSpaceToSpace(row) as Space),
          address: HYPHA_USDC_RECIPIENT,
        },
      ];
    }
  } catch (err) {
    console.error('Failed to fetch the Hypha recipient space:', err);
  }

  return (
    <WalletActionFrame
      lang={lang}
      backLabel={t('backToWallet')}
      title={t('shortcuts.buyHypha')}
    >
      <MyWalletPurchaseHyphaTokensClient
        spaces={spaces}
        closePanelUrl={`/${lang}/my-wallet`}
      />
    </WalletActionFrame>
  );
}
