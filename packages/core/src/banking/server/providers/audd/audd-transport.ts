import 'server-only';

import { request as httpsRequest, Agent as HttpsAgent } from 'node:https';
import { createHash } from 'node:crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Shared `node:https` transport for AUDD's Gateway `/customer/*` API (Flow 1 — identity/KYC).
 * Each API call lives in its own file (`audd-*.ts`); all of them call `auddRequest` here.
 *
 * Every `/customer/*` call needs mutual TLS (client cert registered against the Hypha company)
 * **and** the source IP on AUDD's allow-list — both enforced at their gateway; a `403` means one
 * of the two failed. In Preview/Prod that IP comes from the WS8 VPS relay — a blind TCP/CONNECT
 * forward (#2362 D1) that never terminates TLS, so the mTLS handshake to AUDD completes
 * end-to-end, unmodified, riding inside the tunnel. `AUDD_GATEWAY_HTTPS_PROXY` (full proxy URL,
 * credentials embedded — `https://<user>:<pass>@<relay-host>:<port>`, TLS-wrapped since #2474 D20
 * to protect that credential in transit) routes through it via
 * `HttpsProxyAgent`; unset ⇒ connect to AUDD directly (only reachable from an already-allowlisted
 * egress, e.g. the VPS itself during the SSH-tunnel-based local-dev workaround, #2362 D3).
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

export type AuddRequestOptions = {
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

export async function auddRequest<T>(options: AuddRequestOptions): Promise<T> {
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

/** Normalise any seed into an AUDD-legal 32-char `Idempotency-Key`. */
export function toAuddIdempotencyKey(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}
