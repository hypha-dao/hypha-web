import type { NextRequest, NextResponse } from 'next/server';

/**
 * @summary Pure middleware which does not save or pass anything to the next
 *          handler
 * @param request Its own copy of the original request
 * @returns Void in case of success or response to return an error to a
 *          requester
 * @throws Can throw an exception, it will be interpreted as internal
 *         server error
 */
export type Middleware = (request: Request) => Promise<NextResponse | void>;

/**
 * @summary Parameters for Next route handler
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route#parameters
 */
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
