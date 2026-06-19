import {
  COHERENCE_ORDERS,
  CoherenceBlock,
  CoherenceOrder,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import {
  getEnableCoherence,
  getEnableHumanChat,
} from '@hypha-platform/feature-flags';
import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';
import { getDhoPathOverview } from '../overview/constants';

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
  const coherenceEnabled = await getEnableCoherence();
  if (!coherenceEnabled) {
    redirect(getDhoPathOverview(params.lang, params.id));
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
    priorityRaw === 'critical' ||
    priorityRaw === 'high' ||
    priorityRaw === 'medium' ||
    priorityRaw === 'low'
      ? priorityRaw
      : 'all';

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        <CoherenceBlock
          lang={lang}
          spaceSlug={id}
          order={order}
          priorityFilter={priorityFilter}
          humanChatEnabled={humanChatEnabled}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
