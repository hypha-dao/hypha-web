import { NextRequest, NextResponse } from 'next/server';
import { NextMiddlewareChain, NextMiddlewareFunction } from './types';
import { CONNECT_SOURCES } from '../../config/connect-sources';
import { IMAGE_HOSTS } from '../../config/image-hosts';

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
  // FIXME: workaround to meet CSP. These two scripts ignore nonce
  const SCRIPT_HASHES = [
    // Uploadthing
    "'sha256-9rh1hg0t8gzBb+71sg04fUOw1ZnwOMplqN4Jqi1j5o4='",
    // Next theme
    "'sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk='",
  ].join(' ');
  const imageSrc = [
    'data:',
    ...IMAGE_HOSTS.map((host) => `https://${host}`),
  ].join(' ');

  return (request: NextRequest) => {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const unsafeForDevelopment =
      process.env.NODE_ENV === 'development'
        ? "'unsafe-inline' 'unsafe-eval'"
        : `'nonce-${nonce}' 'strict-dynamic'`;
    const cspHeaderValue =
      [
        "default-src 'self'",
        `script-src 'self' ${unsafeForDevelopment} ${SCRIPT_HASHES} https://challenges.cloudflare.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        `img-src 'self' ${imageSrc}`,
        "font-src 'self' https://fonts.gstatic.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org',
        'frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com',
        `connect-src 'self' ${CONNECT_SOURCES.join(' ')}`,
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
