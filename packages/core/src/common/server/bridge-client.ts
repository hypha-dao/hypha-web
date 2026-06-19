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
  /** Present on GET /v0/kyc_links/{id}; used for endorsement KYC link query param only. */
  email?: string;
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

export type BridgeMissingRequirementItem =
  | string
  | { object_type: string; object_id: string; all_of: string[] };

export type BridgeEndorsementRequirements = {
  complete?: string[];
  pending?: string[];
  missing?: { all_of?: BridgeMissingRequirementItem[] } | null;
  issues?: (string | Record<string, unknown>)[];
};

export type BridgeCustomerEndorsement = {
  name: string;
  status: string;
  additionalRequirements?: unknown[];
  requirements?: BridgeEndorsementRequirements;
};

export type BridgeAssociatedPerson = {
  id: string;
  email?: string;
};

export type BridgeGetCustomerResponse = {
  id: string;
  type: 'individual' | 'business';
  status?: string;
  email?: string;
  physical_address?: BridgeCustomerAddress | null;
  residential_address?: BridgeCustomerAddress | null;
  registered_address?: BridgeCustomerAddress | null;
  endorsements?: BridgeCustomerEndorsement[];
  associated_persons?: BridgeAssociatedPerson[];
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

export type BridgeGetCustomerKycLinkOptions = {
  endorsement?: string;
  /** Must match the email used when the Bridge customer was created. */
  email?: string;
};

function buildCustomerKycLinkQuery(
  options?: BridgeGetCustomerKycLinkOptions,
): string {
  if (!options) {
    return '';
  }

  const params = new URLSearchParams();
  if (options.endorsement) {
    params.set('endorsement', options.endorsement);
  }
  if (options.email) {
    params.set('email', options.email);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * GET /customers/{id}/kyc_link returns a full KYC link object on initial onboarding,
 * but additional endorsements often return only `{ url }`.
 */
export function normalizeBridgeCustomerKycLinkResponse(
  parsed: unknown,
  fallback: { customerId: string; existingKycLinkId: string },
): BridgeCreateKycLinkResponse {
  if (isBridgeKycLinkRecord(parsed)) {
    return parsed;
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    const link =
      typeof record.url === 'string'
        ? record.url
        : typeof record.kyc_link === 'string'
        ? record.kyc_link
        : null;

    if (link) {
      return {
        id:
          typeof record.id === 'string' &&
          record.id.length > 0 &&
          record.id !== fallback.customerId
            ? record.id
            : fallback.existingKycLinkId,
        customer_id:
          typeof record.customer_id === 'string'
            ? record.customer_id
            : fallback.customerId,
        kyc_link: link,
        kyc_status:
          typeof record.kyc_status === 'string'
            ? record.kyc_status
            : 'not_started',
        tos_status:
          typeof record.tos_status === 'string' ? record.tos_status : null,
      };
    }
  }

  throw new Error(
    'Bridge API returned an unexpected customer KYC link response shape',
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

/** Abort Bridge calls that hang so they fail fast instead of holding the serverless function to the platform timeout. */
const BRIDGE_REQUEST_TIMEOUT_MS = 30_000;

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

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    BRIDGE_REQUEST_TIMEOUT_MS,
  );
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new Error(
        `Bridge API request timed out after ${BRIDGE_REQUEST_TIMEOUT_MS}ms`,
      ) as Error & { status: number };
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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

  if (!isBridgeKycLinkRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected KYC link response shape',
    );
  }

  return parsed;
}

export async function bridgeGetCustomerKycLink(
  customerId: string,
  options?: BridgeGetCustomerKycLinkOptions,
  fallback?: { existingKycLinkId: string },
): Promise<BridgeCreateKycLinkResponse> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(
      customerId,
    )}/kyc_link${buildCustomerKycLinkQuery(options)}`,
    { method: 'GET' },
  );

  return normalizeBridgeCustomerKycLinkResponse(parsed, {
    customerId,
    existingKycLinkId: fallback?.existingKycLinkId ?? customerId,
  });
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

export type BridgeListPaginationParams = {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
};

export type BridgeListResponse<T> = {
  data: T[];
  has_more?: boolean;
};

function parseBridgeListResponse<T>(
  parsed: unknown,
  isItem: (value: unknown) => value is T,
): BridgeListResponse<T> {
  if (Array.isArray(parsed)) {
    const data = parsed.filter(isItem);
    return { data, has_more: false };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { data: [] };
  }

  const record = parsed as Record<string, unknown>;
  const rawData = record.data;
  if (!Array.isArray(rawData)) {
    return { data: [] };
  }

  const data = rawData.filter(isItem);
  const has_more =
    typeof record.has_more === 'boolean' ? record.has_more : undefined;

  return { data, has_more };
}

function buildListQuery(params?: BridgeListPaginationParams): string {
  if (!params) {
    return '';
  }

  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  if (params.starting_after) {
    search.set('starting_after', params.starting_after);
  }
  if (params.ending_before) {
    search.set('ending_before', params.ending_before);
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function bridgeListVirtualAccounts(
  customerId: string,
  params?: BridgeListPaginationParams,
): Promise<BridgeListResponse<BridgeCreateVirtualAccountResponse>> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(
      customerId,
    )}/virtual_accounts${buildListQuery(params)}`,
    { method: 'GET' },
  );

  return parseBridgeListResponse(parsed, isBridgeVirtualAccountRecord);
}

export async function bridgeListTransfers(
  customerId: string,
  params?: BridgeListPaginationParams,
): Promise<BridgeListResponse<BridgeTransferResponse>> {
  const path = `/v0/customers/${encodeURIComponent(
    customerId,
  )}/transfers${buildListQuery(params)}`;

  const parsed = await bridgeRequest(path, { method: 'GET' });

  const result = parseBridgeListResponse(parsed, isBridgeTransferRecord);

  return result;
}

export async function bridgeGetVirtualAccount(
  customerId: string,
  virtualAccountId: string,
): Promise<BridgeCreateVirtualAccountResponse> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(
      customerId,
    )}/virtual_accounts/${encodeURIComponent(virtualAccountId)}`,
    { method: 'GET' },
  );

  if (!isBridgeVirtualAccountRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected virtual account response shape',
    );
  }

  return parsed;
}

export function assertTransferOwnedByCustomer(
  transfer: BridgeTransferResponse,
  customerId: string,
): void {
  if (transfer.on_behalf_of && transfer.on_behalf_of !== customerId) {
    throw new Error('Transfer does not belong to this customer');
  }
}

export type BridgeExternalAccountAddress = {
  street_line_1: string;
  street_line_2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
};

export type BridgeCreateExternalAccountRequest = {
  currency: string;
  account_type: string;
  bank_name?: string;
  account_name?: string;
  account_owner_name?: string;
  account_owner_type?: 'individual' | 'business';
  business_name?: string;
  first_name?: string;
  last_name?: string;
  iban?: { account_number: string; bic?: string; country: string };
  bic?: string;
  account?: {
    routing_number?: string;
    account_number?: string;
    checking_or_savings?: 'checking' | 'savings';
    sort_code?: string;
  };
  swift?: {
    account:
      | { account_number: string; bic?: string; country: string } // IBAN account
      | { account_number: string; bic: string }; // non-IBAN (unknown) account
    address: BridgeExternalAccountAddress;
    category: string;
    purpose_of_funds: string[];
    short_business_description: string;
  };
  address?: BridgeExternalAccountAddress;
};

export type BridgeExternalAccountResponse = {
  id: string;
  customer_id?: string;
  active?: boolean;
  currency?: string;
  account_type?: string;
  bank_name?: string;
  account_name?: string;
  account_owner_name?: string;
  last_4?: string;
  account?: {
    last_4?: string;
    routing_number?: string;
    sort_code?: string;
    checking_or_savings?: string;
  };
  iban?: {
    last_4?: string;
    country?: string;
  };
  created_at?: string;
  updated_at?: string;
};

export type BridgeCreateLiquidationAddressRequest = {
  chain: string;
  currency: string;
  external_account_id: string;
  destination_payment_rail?: string;
  destination_currency?: string;
  destination_wire_message?: string;
  destination_sepa_reference?: string;
  destination_ach_reference?: string;
};

export type BridgeLiquidationAddressResponse = {
  id: string;
  customer_id?: string;
  chain: string;
  currency: string;
  address: string;
  external_account_id?: string;
  destination_payment_rail?: string;
  destination_currency?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
};

function isBridgeExternalAccountRecord(
  value: unknown,
): value is BridgeExternalAccountResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.id === 'string';
}

function isBridgeLiquidationAddressRecord(
  value: unknown,
): value is BridgeLiquidationAddressResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.chain === 'string' &&
    typeof record.currency === 'string' &&
    typeof record.address === 'string'
  );
}

export async function bridgeCreateExternalAccount(
  customerId: string,
  body: BridgeCreateExternalAccountRequest,
  idempotencyKey: string,
): Promise<BridgeExternalAccountResponse> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(customerId)}/external_accounts`,
    {
      method: 'POST',
      body,
      idempotencyKey,
    },
  );

  if (!isBridgeExternalAccountRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected external account response shape',
    );
  }

  return parsed;
}

export async function bridgeListExternalAccounts(
  customerId: string,
  params?: BridgeListPaginationParams,
): Promise<BridgeListResponse<BridgeExternalAccountResponse>> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(
      customerId,
    )}/external_accounts${buildListQuery(params)}`,
    { method: 'GET' },
  );

  return parseBridgeListResponse(parsed, isBridgeExternalAccountRecord);
}

export async function bridgeCreateLiquidationAddress(
  customerId: string,
  body: BridgeCreateLiquidationAddressRequest,
  idempotencyKey: string,
): Promise<BridgeLiquidationAddressResponse> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(customerId)}/liquidation_addresses`,
    {
      method: 'POST',
      body,
      idempotencyKey,
    },
  );

  if (!isBridgeLiquidationAddressRecord(parsed)) {
    throw new Error(
      'Bridge API returned an unexpected liquidation address response shape',
    );
  }

  return parsed;
}

export async function bridgeListLiquidationAddresses(
  customerId: string,
  params?: BridgeListPaginationParams,
): Promise<BridgeListResponse<BridgeLiquidationAddressResponse>> {
  const parsed = await bridgeRequest(
    `/v0/customers/${encodeURIComponent(
      customerId,
    )}/liquidation_addresses${buildListQuery(params)}`,
    { method: 'GET' },
  );

  return parseBridgeListResponse(parsed, isBridgeLiquidationAddressRecord);
}
