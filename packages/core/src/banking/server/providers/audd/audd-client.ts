import 'server-only';

import { request as httpsRequest, Agent as HttpsAgent } from 'node:https';
import { createHash } from 'node:crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Thin HTTP client for AUDD's Gateway `/customer/*` API (Flow 1 — identity/KYC).
 *
 * Distilled from `audd-gateway-api-reference.md`. Every `/customer/*` call needs mutual TLS
 * (client cert registered against the Hypha company) **and** the source IP on AUDD's allow-list —
 * both enforced at their gateway; a `403` means one of the two failed. In Preview/Prod that IP
 * comes from the WS8 VPS relay — a blind TCP/CONNECT forward (#2362 D1) that never terminates
 * TLS, so the mTLS handshake to AUDD completes end-to-end, unmodified, riding inside the tunnel.
 * `AUDD_GATEWAY_HTTPS_PROXY` (full proxy URL, credentials embedded —
 * `http://<user>:<pass>@<relay-host>:<port>`) routes through it via `HttpsProxyAgent`; unset ⇒
 * connect to AUDD directly (only reachable from an already-allowlisted egress, e.g. the VPS itself
 * during the SSH-tunnel-based local-dev workaround, #2362 D3).
 *
 * Uses `node:https` rather than global `fetch` so an `https.Agent` can carry the client cert/key
 * (undici's `fetch` ignores `https.Agent`) — `HttpsProxyAgent` is built on the same `http.Agent`
 * contract, so it slots in as a drop-in replacement for the direct-connect agent below.
 */

const DEFAULT_AUDD_API_BASE_URL = 'https://api.sandbox.audd.digital';
const AUDD_REQUEST_TIMEOUT_MS = 30_000;

export type AuddClientConfig = {
  baseUrl: string;
  apiKey: string;
  cert?: string;
  key?: string;
  keyPassphrase?: string;
  /** Full proxy URL with credentials embedded, e.g. `http://user:pass@host:port` (WS8). */
  httpsProxy?: string;
};

function readPem(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  // Env vars commonly carry PEM blocks with literal "\n" — restore real newlines.
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

export function getAuddClientConfig(): AuddClientConfig {
  const apiKey = process.env.AUDD_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing required environment variable: AUDD_GATEWAY_API_KEY',
    );
  }

  const rawBaseUrl = process.env.AUDD_GATEWAY_API_BASE_URL?.trim();
  const baseUrl = rawBaseUrl || DEFAULT_AUDD_API_BASE_URL;
  if (!rawBaseUrl) {
    console.warn(
      'AUDD_GATEWAY_API_BASE_URL is not set; defaulting to AUDD sandbox API',
    );
  }

  return {
    baseUrl,
    apiKey,
    cert: readPem(process.env.AUDD_GATEWAY_CLIENT_CERT),
    key: readPem(process.env.AUDD_GATEWAY_CLIENT_KEY),
    keyPassphrase: process.env.AUDD_GATEWAY_CLIENT_KEY_PASSPHRASE || undefined,
    httpsProxy: process.env.AUDD_GATEWAY_HTTPS_PROXY || undefined,
  };
}

export type AuddApiError = Error & { status: number; body: unknown };

function auddApiError(status: number, body: unknown): AuddApiError {
  const detail =
    typeof body === 'object' && body !== null
      ? JSON.stringify(body)
      : String(body);
  const error = new Error(
    `AUDD Gateway API error (${status}): ${detail.slice(0, 500)}`,
  ) as AuddApiError;
  error.status = status;
  error.body = body;
  return error;
}

type AuddRequestOptions = {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  config?: AuddClientConfig;
};

function buildQuery(
  query: Record<string, string | number | undefined> | undefined,
): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(name, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function auddRequest<T>(options: AuddRequestOptions): Promise<T> {
  const config = options.config ?? getAuddClientConfig();
  const url = new URL(
    `${config.baseUrl.replace(/\/$/, '')}${options.path}${buildQuery(
      options.query,
    )}`,
  );

  const payload =
    options.body !== undefined ? JSON.stringify(options.body) : undefined;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(Buffer.byteLength(payload));
  }

  // The mTLS cert/key apply to the *destination* handshake (AUDD) either way — direct or
  // tunnelled through the relay. `HttpsProxyAgent` forwards its cert/key options to the
  // `tls.connect()` it runs after the CONNECT completes, so the same options object works for
  // both agent types below.
  const tlsOptions = {
    cert: config.cert,
    key: config.key,
    passphrase: config.keyPassphrase,
  };

  const agent = config.httpsProxy
    ? new HttpsProxyAgent(config.httpsProxy, tlsOptions)
    : config.cert && config.key
    ? new HttpsAgent({ ...tlsOptions, keepAlive: false })
    : undefined;

  const raw = await new Promise<{ status: number; text: string }>(
    (resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: options.method,
          headers,
          agent,
          timeout: AUDD_REQUEST_TIMEOUT_MS,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk as Buffer));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              text: Buffer.concat(chunks).toString('utf8'),
            }),
          );
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(
          Object.assign(
            new Error(
              `AUDD Gateway API request timed out after ${AUDD_REQUEST_TIMEOUT_MS}ms`,
            ),
            { status: 504 },
          ),
        );
      });
      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    },
  ).finally(() => agent?.destroy());

  let parsed: unknown;
  try {
    parsed = raw.text ? JSON.parse(raw.text) : null;
  } catch {
    parsed = raw.text;
  }

  if (raw.status < 200 || raw.status >= 300) {
    throw auddApiError(raw.status, parsed);
  }

  return parsed as T;
}

export type AuddTokenResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
};

export type AuddCustomerResponse = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  dateCreated?: string;
  merchantGroupId?: string | null;
  merchantGroupName?: string | null;
  active?: boolean;
  tierId?: string | null;
  tierName?: string | null;
  companyType?: string;
};

export type AuddCustomerListResponse = {
  items: AuddCustomerResponse[];
  total: number;
};

export type AuddKycSubmissionResponse = {
  customerId: string;
  kycStatus: string;
  submittedAt?: string;
  verificationUrl: string;
};

export type AuddCreateCustomerBody = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  addressLine1: string;
  suburb: string;
  postcode: string;
  state: string;
  country: string;
  companyType: string;
  middleName?: string;
  addressLine2?: string;
  merchantGroupId?: string;
  registrationNumber?: string;
  companyBusinessName?: string;
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

/** `POST /customer/customers` — `Idempotency-Key` must be exactly 32 chars. */
export async function auddCreateCustomer(
  body: AuddCreateCustomerBody,
  auth: { accessToken: string; idempotencyKey: string },
  config?: AuddClientConfig,
): Promise<AuddCustomerResponse> {
  return auddRequest<AuddCustomerResponse>({
    method: 'POST',
    path: '/customer/customers',
    body,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Idempotency-Key': auth.idempotencyKey,
    },
    config,
  });
}

/** `POST /customer/customers/{id}/kyc` — body `{ tierId }` only; `202` carries `verificationUrl`. */
export async function auddSubmitKyc(
  customerId: string,
  body: { tierId: string },
  auth: { accessToken: string; idempotencyKey: string },
  config?: AuddClientConfig,
): Promise<AuddKycSubmissionResponse> {
  return auddRequest<AuddKycSubmissionResponse>({
    method: 'POST',
    path: `/customer/customers/${encodeURIComponent(customerId)}/kyc`,
    body,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Idempotency-Key': auth.idempotencyKey,
    },
    config,
  });
}

/**
 * `GET /customer/customers` — `kycStatus` is **filter-only** (never in the response), so reading
 * one customer's KYC state means probing each candidate value and checking membership.
 */
export async function auddListCustomers(
  params: {
    accessToken: string;
    kycStatus?: string;
    query?: string;
    limit?: number;
    index?: number;
  },
  config?: AuddClientConfig,
): Promise<AuddCustomerListResponse> {
  return auddRequest<AuddCustomerListResponse>({
    method: 'GET',
    path: '/customer/customers',
    query: {
      kycStatus: params.kycStatus,
      query: params.query,
      limit: params.limit,
      index: params.index,
    },
    headers: { Authorization: `Bearer ${params.accessToken}` },
    config,
  });
}

/** Normalise any seed into an AUDD-legal 32-char `Idempotency-Key`. */
export function toAuddIdempotencyKey(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}
