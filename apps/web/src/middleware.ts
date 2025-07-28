import { composeMiddleware, cspMiddleware } from './lib/middleware/next';
import { middleware as i18nMiddleware } from '@hypha-platform/i18n';

const middlewareChain = composeMiddleware([i18nMiddleware, cspMiddleware()]);

// Export the middleware chain as the main middleware
export const middleware = middlewareChain;

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: [
    '/((?!api|signin|placeholder|.well-known|_next/static|_next/image|favicon.ico).*)',
  ],
};
