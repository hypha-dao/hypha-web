import {
  COHERENCE_ORDERS,
  CoherenceBlock,
  CoherenceOrder,
} from '@hypha-platform/epics';
import { TabScreenTitle } from '../_components/tab-screen-title';
import {
  getEnableCoherence,
  getEnableHumanChat,
} from '@hypha-platform/feature-flags';
import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getDhoPathAgreements } from '../agreements/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    order?: string;
    type?: string;
  }>;
};

export default async function CoherencePage(props: PageProps) {
  const params = await props.params;
  const tCoherence = await getTranslations('CoherenceTab');
  const coherenceEnabled = await getEnableCoherence();
  if (!coherenceEnabled) {
    redirect(getDhoPathAgreements(params.lang, params.id));
  }

  const humanChatEnabled = await getEnableHumanChat();
  const searchParams = await props.searchParams;

  const { lang, id } = params;

  const orderRaw = searchParams?.order;
  const order: CoherenceOrder =
    orderRaw && COHERENCE_ORDERS.includes(orderRaw as CoherenceOrder)
      ? (orderRaw as CoherenceOrder)
      : 'mostrecent';

  return (
    <div className="flex flex-col gap-6 py-4">
      <TabScreenTitle title={tCoherence('signals')} />
      <CoherenceBlock
        lang={lang}
        spaceSlug={id}
        order={order}
        humanChatEnabled={humanChatEnabled}
      />
    </div>
  );
}
