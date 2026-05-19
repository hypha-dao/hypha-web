import 'server-only';

const DEFAULT_BRIDGE_API_BASE_URL = 'https://api.sandbox.bridge.xyz';

export type BridgeCreateKycLinkRequest = {
  full_name: string;
  email: string;
  type: 'business' | 'individual';
  endorsements?: string[];
  redirect_uri?: string;
};

export type BridgeCreateKycLinkResponse = {
  id: string;
  /** Present after KYC progresses; often absent on initial POST /v0/kyc_links. */
  customer_id?: string | null;
  kyc_link: string;
  tos_link: string;
  kyc_status: string;
  tos_status: string;
  created_at: string;
};

function getBridgeConfig() {
  const apiKey = process.env.BRIDGE_API_KEY;
  const baseUrl =
    process.env.BRIDGE_API_BASE_URL ?? DEFAULT_BRIDGE_API_BASE_URL;

  if (!apiKey) {
    throw new Error('Missing required environment variable: BRIDGE_API_KEY');
  }

  if (!process.env.BRIDGE_API_BASE_URL) {
    console.warn(
      'BRIDGE_API_BASE_URL is not set; defaulting to Bridge sandbox API',
    );
  }

  return { apiKey, baseUrl };
}

export async function bridgeCreateKycLink(
  body: BridgeCreateKycLinkRequest,
  idempotencyKey: string,
): Promise<BridgeCreateKycLinkResponse> {
  const { apiKey, baseUrl } = getBridgeConfig();
  const url = `${baseUrl.replace(/\/$/, '')}/v0/kyc_links`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const detail =
      typeof parsed === 'object' && parsed !== null
        ? JSON.stringify(parsed)
        : String(parsed);
    throw new Error(
      `Bridge API error (${response.status}): ${detail.slice(0, 500)}`,
    );
  }

  return parsed as BridgeCreateKycLinkResponse;
}
