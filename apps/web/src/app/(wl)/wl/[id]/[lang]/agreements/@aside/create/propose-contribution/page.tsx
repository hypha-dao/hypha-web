import { getWhiteLabelSpace } from '@web/app/(wl)/_lib/space';
import { requireCreateAction } from '@web/lib/white-label/require-create-action';
import { CreateContributionOverlay } from './create-contribution-overlay';

type PageProps = { params: Promise<{ id: string; lang: string }> };

/**
 * Propose a contribution over Agreements. Served on a host with login whose
 * client enabled `contribution`; membership is checked in the client (on
 * chain, fail closed).
 */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  await requireCreateAction('contribution');
  const space = await getWhiteLabelSpace(id);
  return (
    <CreateContributionOverlay
      spaceId={space.id}
      web3SpaceId={space.web3SpaceId ?? undefined}
    />
  );
}
