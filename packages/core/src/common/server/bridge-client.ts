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
  tos_link?: string | null;
  kyc_status: string;
  tos_status?: string | null;
  created_at?: string;
};

export type BridgeGetKycLinkResponse = BridgeCreateKycLinkResponse;

export type BridgeCreateVirtualAccountRequest = {
  source: { currency: string };
  destination: {
    payment_rail: string;
    currency: string;
    address: string;
  };
};

export type BridgeCreateVirtualAccountResponse = {
  id: string;
  status: string;
  developer_fee_percent?: string;
  destination?: {
    currency?: string;
    payment_rail?: string;
    address?: string;
  };
  /** Legacy/alternate shape; sandbox often omits this. */
  source?: { currency?: string; payment_rail?: string };
  source_deposit_instructions: Record<string, unknown>;
};

export type BridgeSimulateKycApprovalResponse = {
  success: boolean;
  customer_id: string;
  kyc_status: string;
  message: string;
};

export type BridgeCustomerAddress = {
  street_line_1: string;
  street_line_2?: string;
  city: string;
  subdivision?: string;
  postal_code?: string;
  country: string;
};

export type BridgeCustomerEndorsement = {
  name: string;
  status: string;
  additionalRequirements?: unknown[];
  requirements?: Record<string, unknown>;
};

export type BridgeGetCustomerResponse = {
  id: string;
  type: 'individual' | 'business';
  physical_address?: BridgeCustomerAddress | null;
  residential_address?: BridgeCustomerAddress | null;
  registered_address?: BridgeCustomerAddress | null;
  endorsements?: BridgeCustomerEndorsement[];
};

export type BridgeUpdateCustomerRequest = {
  type: 'individual' | 'business';
  residential_address?: BridgeCustomerAddress;
  physical_address?: BridgeCustomerAddress;
  registered_address?: BridgeCustomerAddress;
  business_legal_name?: string;
};

export type BridgeCreateTransferRequest = {
  on_behalf_of: string;
  source: { payment_rail: string; currency: string };
  destination: {
    payment_rail: string;
    currency: string;
    to_address: string;
  };
  amount?: string;
  features?: { flexible_amount?: boolean };
  developer_fee?: string;
  developer_fee_percent?: string;
};

export type BridgeTransferReceipt = {
  initial_amount?: string;
  developer_fee?: string;
  exchange_fee?: string;
  subtotal_amount?: string;
  gas_fee?: string;
  final_amount?: string;
  destination_tx_hash?: string;
  url?: string;
};

export type BridgeTransferResponse = {
  id: string;
  state: string;
  developer_fee?: string;
  developer_fee_percent?: string;
  on_behalf_of?: string;
  amount?: string | null;
  currency?: string;
  source?: { payment_rail?: string; currency?: string };
  destination?: {
    payment_rail?: string;
    currency?: string;
    to_address?: string;
  };
  source_deposit_instructions: Record<string, unknown>;
  receipt?: BridgeTransferReceipt;
  created_at?: string;
  updated_at?: string;
};

function isBridgeCustomerRecord(
  value: unknown,
): value is BridgeGetCustomerResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (record.type === 'individual' || record.type === 'business')
  );
}

function isBridgeKycLinkRecord(
  value: unknown,
): value is BridgeCreateKycLinkResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.kyc_link === 'string' &&
    typeof record.kyc_status === 'string'
  );
}

/**
 * Bridge returns 400 with `existing_kyc_link` when the email already has an active KYC link.
 * Treat it as success — same shape as a normal 200 response.
 */
function extractExistingKycLinkFromErrorBody(
  parsed: unknown,
): BridgeCreateKycLinkResponse | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const existing = (parsed as Record<string, unknown>).existing_kyc_link;
  if (!isBridgeKycLinkRecord(existing)) {
    return null;
  }

  return existing;
}

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

async function bridgeRequest(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'PUT';
    body?: unknown;
    idempotencyKey?: string;
  },
): Promise<unknown> {
  const { apiKey, baseUrl } = getBridgeConfig();
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;

  const headers: Record<string, string> = {
    'Api-Key': apiKey,
    'Content-Type': 'application/json',
  };

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
    const error = new Error(
      `Bridge API error (${response.status}): ${detail.slice(0, 500)}`,
    );
    (error as Error & { status: number; body: unknown }).status =
      response.status;
    (error as Error & { status: number; body: unknown }).body = parsed;
    throw error;
  }

  return parsed;
}

function getVirtualAccountCurrency(
  record: Record<string, unknown>,
): string | null {
  const source = record.source;
  if (typeof source === 'object' && source !== null) {
    const currency = (source as Record<string, unknown>).currency;
    if (typeof currency === 'string') {
      return currency;
    }
  }

  const instructions = record.source_deposit_instructions;
  if (typeof instructions === 'object' && instructions !== null) {
    const currency = (instructions as Record<string, unknown>).currency;
    if (typeof currency === 'string') {
      return currency;
    }
  }

  return null;
}

function isBridgeVirtualAccountRecord(
  value: unknown,
): value is BridgeCreateVirtualAccountResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.status === 'string' &&
    typeof record.source_deposit_instructions === 'object' &&
    record.source_deposit_instructions !== null &&
    getVirtualAccountCurrency(record) !== null
  );
}

export async function bridgeGetKycLink(
  kycLinkId: string,
): Promise<BridgeGetKycLinkResponse> {
  const parsed = await bridgeRequest(
    `/v0/kyc_links/${encodeURIComponent(kycLinkId)}`,
    {
      method: 'GET',
    },
  );

  console.log('GERGERGER');
  console.log(parsed);
  if (!isBridgeKycLinkRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected KYC link response shape',
    );
  }

  return parsed;
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
    if (response.status === 400) {
      const existing = extractExistingKycLinkFromErrorBody(parsed);
      if (existing) {
        return existing;
      }
    }

    const detail =
      typeof parsed === 'object' && parsed !== null
        ? JSON.stringify(parsed)
        : String(parsed);
    throw new Error(
      `Bridge API error (${response.status}): ${detail.slice(0, 500)}`,
    );
  }

  console.log('GERGERGER');
  console.log(parsed);
  if (!isBridgeKycLinkRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected KYC link response shape',
    );
  }

  return parsed;
}

export async function bridgeGetCustomerKycLink(
  customerId: string,
  options?: { endorsement?: string },
): Promise<BridgeCreateKycLinkResponse> {
  const query = options?.endorsement
    ? `?endorsement=${encodeURIComponent(options.endorsement)}`
    : '';
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(customerId)}/kyc_link${query}`,
    { method: 'GET' },
  );

  console.log('GERGERGER');
  console.log(parsed);
  if (!isBridgeKycLinkRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected customer KYC link response shape',
    );
  }

  return parsed;
}

export async function bridgeGetCustomer(
  customerId: string,
): Promise<BridgeGetCustomerResponse> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(customerId)}`,
    { method: 'GET' },
  );

  if (!isBridgeCustomerRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected customer response shape',
    );
  }

  return parsed;
}

export async function bridgeUpdateCustomer(
  customerId: string,
  body: BridgeUpdateCustomerRequest,
): Promise<unknown> {
  return bridgeRequest(`/v0/customers/${encodeURIComponent(customerId)}`, {
    method: 'PUT',
    body,
  });
}

export async function bridgeCreateVirtualAccount(
  customerId: string,
  body: BridgeCreateVirtualAccountRequest,
  idempotencyKey: string,
): Promise<BridgeCreateVirtualAccountResponse> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(customerId)}/virtual_accounts`,
    {
      method: 'POST',
      body,
      idempotencyKey,
    },
  );

  if (!isBridgeVirtualAccountRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected virtual account response shape',
    );
  }

  return parsed;
}

function isBridgeSimulateKycApprovalRecord(
  value: unknown,
): value is BridgeSimulateKycApprovalResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.success === 'boolean' &&
    typeof record.customer_id === 'string' &&
    typeof record.kyc_status === 'string' &&
    typeof record.message === 'string'
  );
}

function isBridgeTransferRecord(
  value: unknown,
): value is BridgeTransferResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.state === 'string' &&
    typeof record.source_deposit_instructions === 'object' &&
    record.source_deposit_instructions !== null
  );
}

export async function bridgeCreateTransfer(
  body: BridgeCreateTransferRequest,
  idempotencyKey: string,
): Promise<BridgeTransferResponse> {
  const parsed = await bridgeRequest('/v0/transfers', {
    method: 'POST',
    body,
    idempotencyKey,
  });

  if (!isBridgeTransferRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected transfer response shape',
    );
  }

  return parsed;
}

export async function bridgeGetTransfer(
  transferId: string,
): Promise<BridgeTransferResponse> {
  const parsed = await bridgeRequest(
    `/v0/transfers/${encodeURIComponent(transferId)}`,
    { method: 'GET' },
  );

  if (!isBridgeTransferRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected transfer response shape',
    );
  }

  return parsed;
}

export async function bridgeSimulateKycApproval(
  customerId: string,
  idempotencyKey: string,
): Promise<BridgeSimulateKycApprovalResponse> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(customerId)}/simulate_kyc_approval`,
    {
      method: 'POST',
      idempotencyKey,
    },
  );

  if (!isBridgeSimulateKycApprovalRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected simulate KYC approval response shape',
    );
  }

  return parsed;
}
