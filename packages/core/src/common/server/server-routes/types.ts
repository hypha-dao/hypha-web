import type { NextRequest, NextResponse } from 'next/server';

/**
 * @summary Pure middleware which does not save or pass anything to the next
 *          handler
 * @param request Its own copy of the original request
 * @returns Response to know whether to continue or not. Any non-ok response
 *          aborts the processing and returns the response back to a client
 */
export type Middleware = (request: Request) => Promise<NextResponse>;

export type HandlerContext<Params extends Record<string, string>, T> = {
  params: Promise<Params>;
} & T;

/**
 * @summary Request handler for Next.js server route
 * @param request Incoming request
 * @param context Context to get URI params or other predefined data
 */
export type Handler<T extends Record<string, string>, Y = {}> = (
  request: NextRequest,
  context: HandlerContext<T, Y>,
) => Promise<NextResponse>;
