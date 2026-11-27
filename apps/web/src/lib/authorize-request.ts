import {
  guardResource,
  type AuthServerConfig,
  type VerifiedAccessToken,
} from '@hypha-platform/auth-server/server';
import type {
  Caller,
  Failure,
  VerifiedClaims,
} from '@hypha-platform/core/server';

/**
 * The one entry helper for every authorization-server-protected surface (the MCP now, the
 * API routes later). Fixed order, every request: GUARD (token, audience, whitelist, scope)
 * -> optional client check -> RESOLVER (token subject to a person) -> RATE SLOT. A surface is
 * configuration, never code, so a new surface cannot skip a step.
 */
export type Surface = {
  /** The resource the token must have been issued for (RFC 8707). */
  audience: string;
  /** The scope the token must carry. */
  scope: string;
  /** Protected-resource metadata URL (RFC 9728), added to every 401 challenge. */
  resourceMetadataUrl?: string;
  /**
   * Optional client-key check for surfaces that identify the client another way as well (the
   * API's `client_mismatch` rule). Return a response to refuse. The MCP carries no client key.
   */
  checkClient?: (
    request: Request,
    token: VerifiedAccessToken,
  ) => Promise<Response | null>;
};

export type RateSlot = {
  /** Take one slot for this person; `retryAfterSeconds` is set when the limit is hit. */
  take(key: string): { ok: true } | { ok: false; retryAfterSeconds: number };
};

export type ResolveResult =
  | { ok: true; caller: Extract<Caller, { kind: 'user' }> }
  | Failure;

export type AuthorizeDeps = {
  config: Pick<AuthServerConfig, 'allowedPersonIds'> & { issuer?: string };
  /** Test seam: the issuer's key set; defaults to the issuer's own (remote, cached). */
  keys?: Parameters<typeof guardResource>[2]['keys'];
  resolve: (claims: VerifiedClaims) => Promise<ResolveResult>;
  slot?: RateSlot;
};

/** A request that passed the guard but cannot proceed as a person; shown as a clear tool error. */
export type Refusal = {
  code: 'no_profile' | 'rate_limited';
  message: string;
  retryAfterSeconds?: number;
};

export type AuthorizeResult =
  | { ok: false; response: Response }
  | {
      ok: true;
      access:
        | { kind: 'caller'; caller: Extract<Caller, { kind: 'user' }> }
        | { kind: 'refused'; refusal: Refusal };
      /** For the log line only (allow-listed fields), never for decisions. */
      clientId: string;
    };

function withResourceMetadata(
  response: Response,
  resourceMetadataUrl: string | undefined,
): Response {
  const challenge = response.headers.get('www-authenticate');
  if (!resourceMetadataUrl || !challenge) return response;
  const headers = new Headers(response.headers);
  headers.set(
    'www-authenticate',
    `${challenge}, resource_metadata="${resourceMetadataUrl}"`,
  );
  return new Response(response.body, { status: response.status, headers });
}

export async function authorizeRequest(
  request: Request,
  surface: Surface,
  deps: AuthorizeDeps,
): Promise<AuthorizeResult> {
  // 1. Guard (never reimplemented here).
  const guard = await guardResource(request, deps.config, {
    audience: surface.audience,
    scope: surface.scope,
    keys: deps.keys,
  });
  if (!guard.ok) {
    return {
      ok: false,
      response: withResourceMetadata(
        guard.response,
        surface.resourceMetadataUrl,
      ),
    };
  }
  const token = guard.caller;

  // 2. Optional client check.
  const refused = await surface.checkClient?.(request, token);
  if (refused) return { ok: false, response: refused };

  // 3. Resolver.
  const resolved = await deps.resolve({
    kind: 'user',
    sub: token.sub,
    clientId: token.clientId,
    scopes: token.scopes,
    // The verifier already refused a token without a valid grant claim. `'all'` is the
    // resolver's `null` (no restriction beyond the person's own rights).
    spaceGrants: token.spaceGrants === 'all' ? null : token.spaceGrants,
    // Self-declared by the client; the origin label of what it writes (#2756: from the token,
    // never from the authorization server's tables).
    clientName: token.clientName,
  });
  if (!resolved.ok) {
    return {
      ok: true,
      clientId: token.clientId,
      access: {
        kind: 'refused',
        refusal: {
          code: 'no_profile',
          message:
            resolved.message ??
            'No Hypha profile exists for this account. Create one in Hypha first.',
        },
      },
    };
  }

  // 4. Rate slot.
  const slot = deps.slot?.take(token.sub);
  if (slot && !slot.ok) {
    return {
      ok: true,
      clientId: token.clientId,
      access: {
        kind: 'refused',
        refusal: {
          code: 'rate_limited',
          message: `Too many requests. Try again in ${slot.retryAfterSeconds} seconds.`,
          retryAfterSeconds: slot.retryAfterSeconds,
        },
      },
    };
  }

  return {
    ok: true,
    clientId: token.clientId,
    access: { kind: 'caller', caller: resolved.caller },
  };
}

/**
 * A fixed-window limiter held in memory. It is per server instance, so it is a coarse
 * safety net against a runaway client, not a global quota; the platform firewall rule is the
 * real flood control (K33).
 */
export function createRateSlot(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateSlot {
  const now = options.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    take(key) {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= options.windowMs) {
        windows.set(key, { start: t, count: 1 });
        if (windows.size > 5000) {
          for (const [k, v] of windows) {
            if (t - v.start >= options.windowMs) windows.delete(k);
          }
        }
        return { ok: true };
      }
      if (w.count >= options.limit) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((w.start + options.windowMs - t) / 1000),
          ),
        };
      }
      w.count += 1;
      return { ok: true };
    },
  };
}
