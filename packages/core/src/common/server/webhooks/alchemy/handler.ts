import {
  type Abi,
  type Log,
  type ContractEventName,
  parseEventLogs,
} from 'viem';
import { type HandlerParams, type Callback, schemaWebhookBody } from './types';
import { type NextRequest, NextResponse } from 'next/server';
import { newMiddleware } from './middleware';
import { newHandlerWithMiddleware } from '../../route-handlers';

export function newHandler<A extends Abi, E extends ContractEventName<A>>(
  { signingKey, abi, event }: HandlerParams<A, E>,
  ...callbacks: [Callback<A, E>, ...Callback<A, E>[]]
) {
  const middleware =
    process.env.NODE_ENV === 'production' ? [newMiddleware(signingKey)] : [];

  return newHandlerWithMiddleware(middleware, async (request: NextRequest) => {
    const payload = await (async () => {
      try {
        return await request.json();
      } catch (error) {
        console.error('Failed to get request body:', error);
      }
    })();
    if (!payload)
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const body = schemaWebhookBody.safeParse(payload);
    if (!body.success) {
      console.error('Failed to parse body:', body.error);

      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const events = (() => {
      try {
        return parseEventLogs({
          abi: abi,
          eventName: event,
          logs: body.data.event.data.block.logs as Array<Log>,
        });
      } catch (error) {
        console.error('Failed to parse logs:', error);
      }
    })();
    if (!events)
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const callbacksResult = await Promise.allSettled(
      callbacks.map(async (callback) => await callback(events)),
    );
    callbacksResult
      .filter((res) => res.status === 'rejected')
      .forEach(({ reason }) =>
        console.error('Webhook callback failed with error:', reason),
      );

    return NextResponse.json(null, { status: 200 });
  });
}
