import { getWhiteLabelSpace } from '@web/app/(wl)/_lib/space';
import { requireCreateAction } from '@web/lib/white-label/require-create-action';
import { CreateAgreementOverlay } from './create-agreement-overlay';

type PageProps = { params: Promise<{ id: string; lang: string }> };

/**
 * Collective agreement over Agreements. Served on a host with login whose
 * client enabled `agreement`; membership is checked in the client (on chain,
 * fail closed).
 */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  await requireCreateAction('agreement');
  const space = await getWhiteLabelSpace(id);
  return (
    <CreateAgreementOverlay
      spaceId={space.id}
      web3SpaceId={space.web3SpaceId ?? undefined}
    />
  );
}
