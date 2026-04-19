import {
  COHERENCE_ORDERS,
  CoherenceBlock,
  CoherenceOrder,
} from '@hypha-platform/epics';
import {
  getEnableHumanChat,
  getEnableSpaceMemory,
} from '@hypha-platform/feature-flags';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    order?: string;
    type?: string;
  }>;
};

export default async function CoherencePage(props: PageProps) {
  const humanChatEnabled = await getEnableHumanChat();
  const spaceMemoryEnabled = await getEnableSpaceMemory();

  const params = await props.params;
  const searchParams = await props.searchParams;

  const { lang, id } = params;

  const orderRaw = searchParams?.order;
  const order: CoherenceOrder =
    orderRaw && COHERENCE_ORDERS.includes(orderRaw as CoherenceOrder)
      ? (orderRaw as CoherenceOrder)
      : 'mostrecent';

  return (
    <CoherenceBlock
      lang={lang}
      spaceSlug={id}
      order={order}
      humanChatEnabled={humanChatEnabled}
      spaceMemoryEnabled={spaceMemoryEnabled}
    />
  );
}
