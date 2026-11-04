import { type AuthServerConfig } from './config';
import { isPersonAllowed } from './gate';
import {
  AccessTokenError,
  verifyAccessToken,
  type VerifiedAccessToken,
} from './verify';

export type GuardResult =
  | { ok: true; caller: VerifiedAccessToken }
  | { ok: false; response: Response };

function problem(
  status: 401 | 403,
  error: string,
  scope?: string,
): GuardResult {
  const challenge = `Bearer error="${error}"${
    scope ? ` scope="${scope}"` : ''
  }`;
  return {
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: {
        'content-type': 'application/json',
        'www-authenticate': challenge,
        'cache-control': 'no-store',
      },
    }),
  };
}

/**
 * Resource-side guard: what a protected route (the test route now, the MCP server later) does
 * on every request. Verifies the bearer token for the audience, applies the whitelist again,
 * and checks the required scope. Does not touch the database.
 */
export async function guardResource(
  request: Request,
  config: Pick<AuthServerConfig, 'allowedPersonIds'> & { issuer?: string },
  options: {
    audience: string;
    scope?: string;
    keys?: Parameters<typeof verifyAccessToken>[1]['keys'];
  },
): Promise<GuardResult> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return problem(401, 'invalid_request');
  let caller: VerifiedAccessToken;
  try {
    caller = await verifyAccessToken(match[1]!, {
      audience: options.audience,
      issuer: config.issuer,
      keys: options.keys,
    });
  } catch (error) {
    if (error instanceof AccessTokenError) return problem(401, 'invalid_token');
    throw error;
  }
  if (!isPersonAllowed(config, caller.sub))
    return problem(403, 'access_denied');
  if (options.scope && !caller.scopes.includes(options.scope)) {
    return problem(403, 'insufficient_scope', options.scope);
  }
  return { ok: true, caller };
}
