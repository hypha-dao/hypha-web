import {
  COHERENCE_ORDERS,
  CoherenceBlock,
  CoherenceOrder,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    order_sig?: string;
    order_conv?: string;
  }>;
};

export default async function CoherencePage(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const { lang, id } = params;

  const orderSignalRaw = searchParams?.order_sig;
  const orderSignal: CoherenceOrder =
    orderSignalRaw &&
    COHERENCE_ORDERS.includes(orderSignalRaw as CoherenceOrder)
      ? (orderSignalRaw as CoherenceOrder)
      : 'mostrecent';
  const orderConversationRaw = searchParams?.order_conv;
  const orderConversation: CoherenceOrder =
    orderConversationRaw &&
    COHERENCE_ORDERS.includes(orderConversationRaw as CoherenceOrder)
      ? (orderConversationRaw as CoherenceOrder)
      : 'mostrecent';

  return (
    <CoherenceBlock
      lang={lang}
      spaceSlug={id}
      orderSignal={orderSignal}
      orderConversation={orderConversation}
    />
  );
}
