import { getAllSpaces, Space } from '@hypha-platform/core/server';
import { ActivateSpacesForm } from '@hypha-platform/epics';
import { Separator } from '@hypha-platform/ui';
import Link from 'next/link';
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
  const tModalAside = await getTranslations('ModalAside');
  const tFooter = await getTranslations('Footer');

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
      title={tModalAside('activateSpacesProfile')}
    >
      <span className="text-2 text-neutral-11">
        {tActions('activateSpaces.contentPrefix')}{' '}
        <Link
          className="text-accent-9 underline"
          href={
            process.env.NEXT_PUBLIC_HYPHA_TOKENOMICS_DOCS_URL ??
            'https://assets.hypha.earth/files/Tokenomics_Paper.pdf'
          }
          target="_blank"
        >
          {tFooter('hyphaTokenomics')}
        </Link>
        {tActions('activateSpaces.contentSuffix')}
      </span>
      {hasError ? (
        <div className="text-error text-sm">
          {tActions('errors.loadSpaces')}
        </div>
      ) : null}
      <Separator />
      <ActivateSpacesForm
        spaces={filteredSpaces}
        initialWeb3SpaceId={initialWeb3SpaceId}
      />
    </WalletActionFrame>
  );
}
