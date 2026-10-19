import { getAllSpaces, Space } from '@hypha-platform/core/server';
import { ActivateSpacesForm } from '@hypha-platform/epics';
import { getTranslations } from 'next-intl/server';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

type PageProps = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ space?: string }>;
};

export default async function MyWalletActivateSpacesPage(props: PageProps) {
  const { lang } = await props.params;
  const { space } = await props.searchParams;
  const initialWeb3SpaceId = /^\d+$/.test(space ?? '')
    ? Number(space)
    : undefined;
  const t = await getTranslations('MyWallet');
  const tActions = await getTranslations('ProfileActions');

  let spaces: Space[] = [];
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
    (entry) => entry?.address && entry.address.trim() !== '',
  );

  return (
    <WalletActionFrame
      lang={lang}
      backLabel={t('backToWallet')}
      title={t('shortcuts.activate')}
    >
      {hasError ? (
        <div className="text-error text-sm">
          {tActions('errors.loadSpaces')}
        </div>
      ) : null}
      <ActivateSpacesForm
        appearance="wallet"
        closeUrl={`/${lang}/my-wallet`}
        spaces={filteredSpaces}
        initialWeb3SpaceId={initialWeb3SpaceId}
      />
    </WalletActionFrame>
  );
}
