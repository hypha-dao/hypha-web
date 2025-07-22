export { middleware } from '@hypha-platform/i18n';

export const config = {
  matcher: [
    '/((?!api|placeholder|.well-known|_next/static|_next/image|favicon.ico|signin|sample).*)',
  ],
};
