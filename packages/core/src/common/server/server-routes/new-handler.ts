import { type NextRequest, NextResponse } from 'next/server';
import type { Middleware, Handler, HandlerContext } from './types';

export function newHandler<Params extends Record<string, string>, Y = {}>(
  middlewares: Middleware[],
  callback: Handler<Params, Y>,
): Handler<Params, Y> {
  return async (req: NextRequest, context: HandlerContext<Params, Y>) => {
    for (const middleware of middlewares) {
      try {
        const resp = await middleware(req.clone());

        if (!resp.ok) return resp;
      } catch (error) {
        console.error('Middleware failed:', error);

        return NextResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 },
        );
      }
    }

    return callback(req, context);
  };
}
