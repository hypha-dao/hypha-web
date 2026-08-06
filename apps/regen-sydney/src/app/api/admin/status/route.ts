import { NextResponse } from 'next/server';

import { requireAdmin } from '@rs/server/auth';
import { getRelayerStatus } from '@rs/server/chain/rsut';
import { retryPendingMints } from '@rs/server/campaign/grants';
import { campaignConfig, getPaymentProviderId } from '@rs/server/config';
import { getPaymentProvider } from '@rs/server/payments';
import { handle } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Operational readout for the admin screen. The relayer needs a one-off
 * `batchSetAuthorizedMinters` call from the RS Core Team executor before it
 * can mint, and there is no way to tell from the app's own state whether that
 * has happened — so it is read from the token contract here.
 */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);

    const provider = getPaymentProvider();
    const relayer = await getRelayerStatus();

    return NextResponse.json({
      relayer,
      payments: {
        provider: getPaymentProviderId(),
        configured: provider.isConfigured(),
      },
      economics: {
        joinBonusRsut: campaignConfig.joinBonusRsut,
        rsutPerAud: campaignConfig.rsutPerAud,
      },
    });
  });
}

/** Re-attempts every grant whose mint has not landed yet. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return NextResponse.json(await retryPendingMints());
  });
}
