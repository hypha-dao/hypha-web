import { NextRequest, NextResponse } from 'next/server';
import { NextMiddlewareChain, NextMiddlewareFunction } from './types';

/**
 * Composes multiple Next.js middleware functions into a single middleware function
 * @param middlewareChain Array of middleware functions to compose
 * @returns A single middleware function that executes the chain
 */
export function composeMiddleware(
  middlewareChain: NextMiddlewareChain,
): NextMiddlewareFunction {
  return (request: NextRequest, response?: NextResponse) => {
    const context = { request, response };

    for (const middleware of middlewareChain) {
      const result = middleware(context.request, context.response);
      if (result) {
        context.response = result;
      }

      // If context.response is set and it has a redirect, return early
      if (
        context.response &&
        (context.response.headers.get('Location') ||
          context.response.status === 301 ||
          context.response.status === 302)
      ) {
        return context.response;
      }
    }

    return context.response;
  };
}

/**
 * Content security policy (CSP) middleware
 * @returns Middleware function
 */
export function cspMiddleware(): NextMiddlewareFunction {
  return (request: NextRequest) => {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const unsafeForDevelopment =
      process.env.NODE_ENV === 'development'
        ? "'unsafe-inline' 'unsafe-eval'"
        : `'nonce-${nonce}' 'strict-dynamic'`;
    const cspHeaderValue =
      [
        "default-src 'self'",
        `script-src 'self' ${unsafeForDevelopment} https://challenges.cloudflare.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        //"img-src 'self' data: blob:",
        "font-src 'self' https://fonts.gstatic.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org',
        'frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com',
        "connect-src 'self' https://auth.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org https://*.rpc.privy.systems https://explorer-api.walletconnect.com",
        "worker-src 'self'",
        "manifest-src 'self'",
      ].join(';') + ';';

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Content-Security-Policy', cspHeaderValue);
    if (process.env.NODE_ENV !== 'development') {
      requestHeaders.set('X-Nonce', nonce);
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set('Content-Security-Policy', cspHeaderValue);

    return response;
  };
}
