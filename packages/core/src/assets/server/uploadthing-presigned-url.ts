import { createHmac } from 'node:crypto';
import { generateSignedURL } from '@uploadthing/shared';

const DOUBLE_ENCODED_PERCENT = /%25[0-9A-Fa-f]{2}/;

export function readUploadThingApiKey(
  token = process.env.UPLOADTHING_TOKEN,
): string | undefined {
  if (!token?.trim()) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(token.trim(), 'base64').toString('utf8'),
    ) as { apiKey?: unknown };
    return typeof parsed.apiKey === 'string' && parsed.apiKey.startsWith('sk_')
      ? parsed.apiKey
      : undefined;
  } catch {
    return undefined;
  }
}

export function isDoubleEncodedUploadThingUrl(href: string): boolean {
  return (
    href.includes('ingest.uploadthing.com') && DOUBLE_ENCODED_PERCENT.test(href)
  );
}

export function rewriteDoubleEncodedUploadThingUrl(
  href: string,
  apiKey: string,
): string {
  if (!isDoubleEncodedUploadThingUrl(href)) return href;

  const parsed = new URL(href);
  parsed.searchParams.delete('signature');

  const rebuilt = new URL(`${parsed.origin}${parsed.pathname}`);
  for (const [key, value] of parsed.searchParams.entries()) {
    let decoded = value;
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        // Keep the once-decoded value from URLSearchParams.
      }
    }
    rebuilt.searchParams.append(key, decoded);
  }

  const signature = `hmac-sha256=${createHmac('sha256', apiKey)
    .update(rebuilt.toString())
    .digest('hex')}`;
  rebuilt.searchParams.append('signature', signature);
  return rebuilt.href;
}

function rewritePresignedJson(value: unknown, apiKey: string): unknown {
  if (typeof value === 'string') {
    return rewriteDoubleEncodedUploadThingUrl(value, apiKey);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => rewritePresignedJson(entry, apiKey));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        rewritePresignedJson(entry, apiKey),
      ]),
    );
  }
  return value;
}

/** Runtime safety net if the bundled SDK still double-encodes MIME types. */
export async function rewriteUploadThingPresignedResponse(
  response: Response,
): Promise<Response> {
  const apiKey = readUploadThingApiKey();
  if (!apiKey) return response;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response;

  const clone = response.clone();
  let payload: unknown;
  try {
    payload = await clone.json();
  } catch {
    return response;
  }

  const rewritten = rewritePresignedJson(payload, apiKey);
  if (JSON.stringify(rewritten) === JSON.stringify(payload)) {
    return response;
  }

  return new Response(JSON.stringify(rewritten), {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export function probeBundledGenerateSignedURL(): {
  patched: boolean;
  includesEncodeURIComponent: boolean;
} {
  const source = Function.prototype.toString.call(generateSignedURL);
  const includesEncodeURIComponent = source.includes('encodeURIComponent');
  return {
    includesEncodeURIComponent,
    patched: !includesEncodeURIComponent,
  };
}
