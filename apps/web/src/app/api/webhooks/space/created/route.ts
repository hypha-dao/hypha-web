import { NextRequest, NextResponse } from 'next/server';
import {
  getAlchemyValidator,
  schemaAlchemyWebhook,
} from '@hypha-platform/core/server';
import { parseEventLogs } from 'viem';
import type { Log } from 'viem';
import { daoSpaceFactoryImplementationAbi } from '@hypha-platform/core/generated';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const alchemySigningKey = process.env.WH_SPACE_CREATED_SIGN_KEY;
    if (!alchemySigningKey) {
      console.error('Alchemy signing key for a webhook is missing');

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }

    const isSignatureValid = await getAlchemyValidator(alchemySigningKey)(
      request,
    );
    if (!isSignatureValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const payload = await request.json();
  const body = schemaAlchemyWebhook.safeParse(payload);
  if (!body.success) {
    console.error('Failed to parse body:', body.error);

    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const logs = body.data.event.data.block.logs;
  try {
    const events = parseEventLogs({
      abi: daoSpaceFactoryImplementationAbi,
      eventName: 'SpaceCreated',
      logs: logs as Array<Log>,
      strict: false,
    });
    console.log('events:', events);

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Failed to parse logs:', error);

    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
