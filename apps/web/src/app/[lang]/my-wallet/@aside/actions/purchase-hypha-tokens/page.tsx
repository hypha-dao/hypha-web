import { getAllSpaces, Space } from '@hypha-platform/core/server';
import {
  ProposalOverlayShell,
  ModalStickyNavigation,
} from '@hypha-platform/epics';
import { getTranslations } from 'next-intl/server';
import { MyWalletPurchaseHyphaTokensClient } from '../../_components/my-wallet-action-clients';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MyWalletPurchaseHyphaTokensPage(
  props: PageProps,
) {
  const { lang } = await props.params;
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

  const basePath = `/${lang}/my-wallet`;

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('buyHyphaTokens')}
          closeUrl={basePath}
          backUrl={`${basePath}/actions`}
          backLabel={tActions('backToActions')}
        />
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
            closePanelUrl={basePath}
          />
        )}
      </div>
    </ProposalOverlayShell>
  );
}
