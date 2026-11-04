import { notFound } from 'next/navigation';
import {
  COHERENCE_ORDERS,
  SpaceTabAccessWrapper,
  type CoherenceOrder,
} from '@hypha-platform/epics';
import {
  getEnableCoherence,
  getEnableHumanChat,
} from '@hypha-platform/feature-flags';
import type { Locale } from '@hypha-platform/i18n';

import { ConnectedCoherenceBlock } from '@web/components/connected-coherence-block';
import type { WhiteLabelPageProps } from '../../../../_lib/space';

type PageProps = WhiteLabelPageProps & {
  searchParams: Promise<{ order?: string }>;
};

export default async function WhiteLabelCoherencePage(props: PageProps) {
  const { id: slug, lang } = await props.params;
  const { order: orderRaw } = await props.searchParams;
  if (!(await getEnableCoherence())) notFound();
  const humanChatEnabled = await getEnableHumanChat();

  const order: CoherenceOrder =
    orderRaw && COHERENCE_ORDERS.includes(orderRaw as CoherenceOrder)
      ? (orderRaw as CoherenceOrder)
      : 'mostupvoted';

  return (
    <SpaceTabAccessWrapper spaceSlug={slug}>
      <div className="flex flex-col gap-4 py-4">
        <ConnectedCoherenceBlock
          lang={lang as Locale}
          spaceSlug={slug}
          order={order}
          humanChatEnabled={humanChatEnabled}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
