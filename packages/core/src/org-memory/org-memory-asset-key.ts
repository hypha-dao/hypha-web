/**
 * Stable opaque keys for org-memory assets (listing + fetch_org_memory_asset).
 * Base64url(JSON) — compact, no secrets.
 */
export type OrgMemoryAssetKeyPayload =
  | { k: 'p'; d: number; u: string }
  | { k: 'm'; r: string; e: string; x: string }
  | { k: 'cr'; i: number }
  | { k: 'ct'; i: number }
  | { k: 'ds'; i: number };

function uint8ToBinaryString(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

function base64UrlEncodeUtf8(json: string): string {
  const bytes = new TextEncoder().encode(json);
  const raw = btoa(uint8ToBinaryString(bytes));
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlDecodeToUtf8(s: string): string | null {
  try {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function serializeOrgMemoryAssetKey(
  payload: OrgMemoryAssetKeyPayload,
): string {
  return base64UrlEncodeUtf8(JSON.stringify(payload));
}

export function parseOrgMemoryAssetKey(
  assetKey: string,
): OrgMemoryAssetKeyPayload | null {
  const trimmed = assetKey.trim();
  if (!trimmed) return null;
  const raw = base64UrlDecodeToUtf8(trimmed);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  if (o.k === 'p' && typeof o.d === 'number' && typeof o.u === 'string') {
    return { k: 'p', d: o.d, u: o.u };
  }
  if (
    o.k === 'm' &&
    typeof o.r === 'string' &&
    typeof o.e === 'string' &&
    typeof o.x === 'string'
  ) {
    return { k: 'm', r: o.r, e: o.e, x: o.x };
  }
  if (o.k === 'cr' && typeof o.i === 'number') {
    return { k: 'cr', i: o.i };
  }
  if (o.k === 'ct' && typeof o.i === 'number') {
    return { k: 'ct', i: o.i };
  }
  if (o.k === 'ds' && typeof o.i === 'number') {
    return { k: 'ds', i: o.i };
  }
  return null;
}
