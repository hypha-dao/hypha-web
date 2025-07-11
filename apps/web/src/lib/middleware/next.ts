import { NextRequest, NextResponse } from 'next/server';
import { NextMiddlewareFunction, NextMiddlewareContext } from './types';
import { IMAGE_HOSTS } from '../../config/image-hosts';
import { CONNECT_SOURCES } from '../../config/connect-sources';

/**
 * A utility type for Next.js middleware chain
 */
export type NextMiddlewareChain = NextMiddlewareFunction[];

/**
 * Composes multiple Next.js middleware functions into a single middleware function
 * @param middlewareChain Array of middleware functions to compose
 * @returns A single middleware function that executes the chain
 */
export function composeMiddleware(
  middlewareChain: NextMiddlewareChain,
): NextMiddlewareFunction {
  return async (request: NextRequest, response?: NextResponse) => {
    // Create a context object that can be modified by middleware
    const context: NextMiddlewareContext = {
      request,
      response,
    };

    // Execute each middleware in sequence
    for (const middleware of middlewareChain) {
      // Pass context to middleware and get the result
      const result = await middleware(context.request, context.response);

      // If middleware returns a response, use it for the next middleware
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

    // Return the final response or undefined
    return context.response;
  };
}

/**
 * Auth middleware for Next.js Edge Runtime
 * @param requireAuth Whether authentication is required
 * @returns Middleware function
 */
export function authMiddleware(requireAuth = true): NextMiddlewareFunction {
  return async (request: NextRequest) => {
    // Get auth token from cookie or header
    const token =
      request.cookies.get('auth-token')?.value ||
      request.headers.get('Authorization')?.replace('Bearer ', '');

    // If auth is required and no token, redirect to login
    if (requireAuth && !token) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('from', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // For routes that don't require auth, just pass through
    return NextResponse.next();
  };
}

/**
 * Logging middleware for Next.js Edge Runtime
 * @returns Middleware function
 */
export function loggingMiddleware(): NextMiddlewareFunction {
  return async (request: NextRequest) => {
    // Log the request
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${
        request.nextUrl.pathname
      }`,
    );

    // Pass through
    return NextResponse.next();
  };
}

/**
 * CORS middleware for Next.js Edge Runtime
 * @param allowedOrigins Array of allowed origins
 * @returns Middleware function
 */
export function corsMiddleware(
  allowedOrigins: string[] = ['*'],
): NextMiddlewareFunction {
  return async (request: NextRequest) => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      response.headers.set(
        'Access-Control-Allow-Origin',
        getAllowedOrigin(request, allowedOrigins),
      );
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );
      response.headers.set('Access-Control-Max-Age', '86400');
      return response;
    }

    // For normal requests, add CORS headers
    const response = NextResponse.next();
    response.headers.set(
      'Access-Control-Allow-Origin',
      getAllowedOrigin(request, allowedOrigins),
    );

    return response;
  };
}

/**
 * Content security policy (CSP) middleware
 * @returns Middleware function
 */
export function cspMiddleware(): NextMiddlewareFunction {
  return async (request: NextRequest) => {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const imageSrc = [
      'data:',
      'blob:',
      IMAGE_HOSTS.map((host) => `https://${host}`).join(' '),
    ];
    const unsafeForDevelopment =
      process.env.NODE_ENV === 'development'
        ? "'unsafe-inline' 'unsafe-eval'"
        : `'nonce-${nonce}'`;
    const cspHeaderValue =
      [
        "default-src 'self'",
        `script-src 'self' ${unsafeForDevelopment} https://challenges.cloudflare.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        `img-src 'self' ${imageSrc.join(' ')}`,
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'child-src https://auth.privy.io https://verify.walletconnect.com https verify.walletconnect.org',
        'frame-src https://auth.privy.io https://verify.walletconnect.com https verify.walletconnect.org https://challenges.cloudflare.com',
        `connect-src 'self' ${CONNECT_SOURCES.join(' ')}`,
        "worker-src 'self'",
        "manifest-src 'self'",
      ].join(';') + ';';

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Content-Security-Policy', cspHeaderValue);
    if (process.env.NODE_ENV === 'production') {
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

/**
 * Helper function to get the allowed origin
 */
function getAllowedOrigin(
  request: NextRequest,
  allowedOrigins: string[],
): string {
  const origin = request.headers.get('Origin') || '';

  if (allowedOrigins.includes('*')) {
    return '*';
  }

  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '';
}
