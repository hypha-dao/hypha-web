import {
  COHERENCE_ORDERS,
  CoherenceOrder,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { ConnectedCoherenceBlock } from '@web/components/connected-coherence-block';
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
      : 'mostupvoted';
  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        <ConnectedCoherenceBlock
          lang={lang}
          spaceSlug={id}
          order={order}
          humanChatEnabled={humanChatEnabled}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
