import { type NextRequest, NextResponse } from 'next/server';
import {
  newHandler,
  newAlchemyMiddleware,
  schemaAlchemyWebhook,
} from '@hypha-platform/core/server';
import { type Log, parseEventLogs } from 'viem';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';

const middleware = (() => {
  if (process.env.NODE_ENV !== 'production') return [];

  const signKey = process.env.WH_PROPOSAL_REJECTED_SIGN_KEY;
  if (!signKey) throw new Error('Webhook signing key is not set');

  return [newAlchemyMiddleware(signKey)];
})();

export const POST = newHandler(middleware, async (request: NextRequest) => {
  const payload = await (async () => {
    try {
      return request.json();
    } catch (error) {
      console.error('Failed to get request body:', error);
    }
  })();
  if (!payload)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const body = schemaAlchemyWebhook.safeParse(payload);
  if (!body.success) {
    console.error('Failed to parse body:', body.error);

    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const logs = body.data.event.data.block.logs;
  try {
    const events = parseEventLogs({
      abi: daoProposalsImplementationAbi,
      eventName: 'ProposalRejected',
      logs: logs as Array<Log>,
    });
    console.log('events:', events);

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Failed to parse logs:', error);

    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
});
