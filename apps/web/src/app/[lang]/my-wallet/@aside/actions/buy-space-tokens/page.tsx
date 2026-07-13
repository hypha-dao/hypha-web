import {
  ProposalOverlayShell,
  ModalStickyNavigation,
} from '@hypha-platform/epics';
import { getTranslations } from 'next-intl/server';
import { MyWalletBuySpaceTokensClient } from '../../../_components/my-wallet-action-clients';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function MyWalletBuySpaceTokensPage(props: PageProps) {
  const { lang } = await props.params;
  const t = await getTranslations({
    locale: lang,
    namespace: 'ProfileActions',
  });
  const tModalAside = await getTranslations('ModalAside');
  const basePath = `/${lang}/my-wallet`;

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('buySpaceTokens')}
          closeUrl={basePath}
          backUrl={`${basePath}/actions`}
          backLabel={t('actions.buySpaceTokens.backLabel')}
        />
        <span className="text-2 text-neutral-11">
          {t('actions.buySpaceTokens.description')}
        </span>
        <MyWalletBuySpaceTokensClient closeUrl={basePath} />
      </div>
    </ProposalOverlayShell>
  );
}
