import { getAllSpaces, Space } from '@hypha-platform/core/server';
import {
  ProposalOverlayShell,
  ModalStickyNavigation,
  ActivateSpacesForm,
} from '@hypha-platform/epics';
import { Separator } from '@hypha-platform/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MyWalletActivateSpacesPage(props: PageProps) {
  const { lang } = await props.params;
  const tActions = await getTranslations('ProfileActions');
  const tModalAside = await getTranslations('ModalAside');
  const tFooter = await getTranslations('Footer');
  const basePath = `/${lang}/my-wallet`;

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
    (space) => space?.address && space.address.trim() !== '',
  );

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('activateSpacesProfile')}
          closeUrl={basePath}
          backUrl={`${basePath}/actions`}
          backLabel={tActions('backToActions')}
        />
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
        <ActivateSpacesForm spaces={filteredSpaces} />
      </div>
    </ProposalOverlayShell>
  );
}
