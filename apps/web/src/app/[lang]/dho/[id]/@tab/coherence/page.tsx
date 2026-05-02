import {
  COHERENCE_ORDERS,
  CoherenceBlock,
  CoherenceOrder,
} from '@hypha-platform/epics';
import { TabScreenTitle } from '../_components/tab-screen-title';
import { ScreenFilterTabs } from '../_components/screen-filter-tabs';
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
    priority?: string;
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
  const priorityRaw = searchParams?.priority;
  const priorityFilter =
    priorityRaw === 'high' || priorityRaw === 'medium' || priorityRaw === 'low'
      ? priorityRaw
      : 'all';

  return (
    <div className="flex flex-col gap-4 py-4">
      <TabScreenTitle
        title={tCoherence('signals')}
        filters={
          <ScreenFilterTabs
            queryKey="priority"
            defaultValue="all"
            items={[
              { value: 'all', label: tCoherence('all') },
              { value: 'high', label: tCoherence('priorities.high') },
              { value: 'medium', label: tCoherence('priorities.medium') },
              { value: 'low', label: tCoherence('priorities.low') },
            ]}
          />
        }
      />
      <CoherenceBlock
        lang={lang}
        spaceSlug={id}
        order={order}
        priorityFilter={priorityFilter}
        humanChatEnabled={humanChatEnabled}
      />
    </div>
  );
}
