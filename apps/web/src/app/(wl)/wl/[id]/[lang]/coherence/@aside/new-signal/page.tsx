import { notFound } from 'next/navigation';
import { getEnableCoherence } from '@hypha-platform/feature-flags';

import { getWhiteLabelSpace } from '@web/app/(wl)/_lib/space';
import { requireCreateAction } from '@web/lib/white-label/require-create-action';
import { CreateSignalOverlay } from './create-signal-overlay';

type PageProps = { params: Promise<{ id: string; lang: string }> };

/**
 * New signal over the Signals section. Served only on a host with login whose
 * client enabled `signal`; membership is checked in the client (on chain,
 * fail closed), as on the main app. No prefill parameters on a host.
 */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  await requireCreateAction('signal');
  if (!(await getEnableCoherence())) notFound();
  const space = await getWhiteLabelSpace(id);
  return (
    <CreateSignalOverlay
      spaceId={space.id}
      web3SpaceId={space.web3SpaceId ?? undefined}
    />
  );
}
