
export { middleware } from '@hypha-platform/i18n';

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: [
    '/((?!api|signin|placeholder|.well-known|_next/static|_next/image|favicon.ico).*)',
  ],
};
