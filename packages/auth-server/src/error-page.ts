/**
 * The page the library redirects to when it cannot safely send an error back to the app (for
 * example an unregistered redirect address). Plain text, fixed wording chosen from a short list by
 * the error code: nothing from the request is echoed, so there is nothing to escape or inject.
 */
const MESSAGES: Record<string, string> = {
  invalid_redirect:
    'The app asked to return to an address it did not register, so nothing was approved.',
  invalid_client: 'Hypha does not recognise this app, so nothing was approved.',
  invalid_request:
    'The app sent a request Hypha could not read, so nothing was approved.',
  invalid_signature: 'This approval expired.',
  access_denied: 'Nothing was approved.',
};
const FALLBACK = 'Something went wrong, so nothing was approved.';
const NEXT_STEP = 'Go back to the app and start again.';

export function authServerErrorPage(request: Request): Response {
  const code = new URL(request.url).searchParams.get('error') ?? '';
  const message = Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : FALLBACK;
  return new Response(`${message} ${NEXT_STEP}\n`, {
    status: 400,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    },
  });
}
