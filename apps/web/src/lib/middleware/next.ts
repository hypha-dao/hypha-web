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
  const imageHosts = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
  const connectSources =
    process.env.NEXT_PUBLIC_CONNECT_SOURCES?.split(', ') ?? [];

  const imageSrc = [
    'data:',
    ...imageHosts.map((host) => `https://${host}`),
  ].join(' ');
  const connectSrc = [
    ...connectSources,
    process.env.NEXT_PUBLIC_RPC_URL ?? '',
  ].join(' ');

  return (request: NextRequest) => {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.ENABLE_LOCALHOST_CSP !== 'true'
    ) {
      return NextResponse.next();
    }

    // FIXME: enable nonce
    const enableUnsafeScripts = "'unsafe-inline' 'unsafe-eval'";
    const cspHeaderValue =
      [
        "default-src 'self'",
        `script-src 'self' ${enableUnsafeScripts} https://challenges.cloudflare.com https://cdn.onesignal.com https://api.onesignal.com https://vercel.live`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://onesignal.com",
        `img-src 'self' ${imageSrc}`,
        "font-src 'self' https://fonts.gstatic.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org',
        'frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com',
        `connect-src 'self' ${connectSrc}`,
        "worker-src 'self'",
        "manifest-src 'self'",
      ].join(';') + ';';

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Content-Security-Policy', cspHeaderValue);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set('Content-Security-Policy', cspHeaderValue);

    return response;
  };
}
