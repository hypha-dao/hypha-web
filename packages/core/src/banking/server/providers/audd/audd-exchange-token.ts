import 'server-only';

import {
  auddRequest,
  getAuddClientConfig,
  type AuddClientConfig,
} from './audd-transport';

export type AuddTokenResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
};

/**
 * `POST /customer/auth/token` — header `X-API-Key`, no body. Returns a ~5-min JWT and no refresh
 * token (re-auth = call this again). `scope` is space-delimited.
 */
export async function auddExchangeToken(
  config?: AuddClientConfig,
): Promise<AuddTokenResponse> {
  const resolved = config ?? getAuddClientConfig();
  return auddRequest<AuddTokenResponse>({
    method: 'POST',
    path: '/customer/auth/token',
    headers: { 'X-API-Key': resolved.apiKey },
    config: resolved,
  });
}
