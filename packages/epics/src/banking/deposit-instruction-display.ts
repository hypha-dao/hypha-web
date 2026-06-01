export function readInstructionString(
  instructions: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = instructions[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function combineInstructionLines(
  parts: (string | null | undefined)[],
): string | null {
  const lines = parts.filter((part): part is string =>
    Boolean(part && part.trim()),
  );
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Destination stablecoin code (e.g. "USDC" / "EURC") for card titles, read from
 * the enriched deposit instructions (`destination_currency`). Falls back to USDC
 * — the platform default when Bridge doesn't echo a destination currency.
 */
export function getDepositDestinationCurrencyCode(
  instructions: Record<string, unknown>,
): string {
  return (
    readInstructionString(instructions, ['destination_currency']) ?? 'usdc'
  ).toUpperCase();
}

export type DepositIdentifierLabelKey =
  | 'iban'
  | 'routingNumber'
  | 'accountNumber'
  | 'sortCode';

export type DepositIdentifierRow = {
  labelKey: DepositIdentifierLabelKey;
  value: string;
};

export type PrimaryDepositIdentifier = DepositIdentifierRow;

/** Normalize Bridge transfer rails to virtual-account rails for display. */
export function normalizePaymentRailForDisplay(paymentRail: string): string {
  if (paymentRail === 'ach_push') {
    return 'ach';
  }
  return paymentRail;
}

function readAccountNumber(
  instructions: Record<string, unknown>,
): string | null {
  return readInstructionString(instructions, [
    'bank_account_number',
    'account_number',
    'clabe',
    'pix_key',
  ]);
}

function readRoutingNumber(
  instructions: Record<string, unknown>,
): string | null {
  return readInstructionString(instructions, [
    'bank_routing_number',
    'routing_number',
  ]);
}

function readSortCode(instructions: Record<string, unknown>): string | null {
  return readInstructionString(instructions, ['sort_code']);
}

/** Copyable rows shown on account/transfer cards (may include multiple fields). */
export function getCardDepositIdentifiers(
  paymentRail: string,
  instructions: Record<string, unknown>,
): DepositIdentifierRow[] {
  const rail = normalizePaymentRailForDisplay(paymentRail);

  switch (rail) {
    case 'sepa': {
      const iban = readInstructionString(instructions, ['iban']);
      return iban ? [{ labelKey: 'iban', value: iban }] : [];
    }
    case 'ach':
    case 'wire': {
      const rows: DepositIdentifierRow[] = [];
      const routing = readRoutingNumber(instructions);
      if (routing) {
        rows.push({ labelKey: 'routingNumber', value: routing });
      }
      const accountNumber = readAccountNumber(instructions);
      if (accountNumber) {
        rows.push({ labelKey: 'accountNumber', value: accountNumber });
      }
      return rows;
    }
    case 'faster_payments': {
      const rows: DepositIdentifierRow[] = [];
      const sortCode = readSortCode(instructions);
      if (sortCode) {
        rows.push({ labelKey: 'sortCode', value: sortCode });
      }
      const accountNumber = readAccountNumber(instructions);
      if (accountNumber) {
        rows.push({ labelKey: 'accountNumber', value: accountNumber });
      }
      return rows;
    }
    default: {
      const iban = readInstructionString(instructions, ['iban']);
      if (iban) {
        return [{ labelKey: 'iban', value: iban }];
      }
      const accountNumber = readAccountNumber(instructions);
      return accountNumber
        ? [{ labelKey: 'accountNumber', value: accountNumber }]
        : [];
    }
  }
}

export type CardDepositCopyBlock = {
  label: string | null;
  copyText: string;
  multiline: boolean;
};

/** Combined copy block for transfer cards (identifiers + reference message). */
export function getTransferCardDepositCopyBlock(
  paymentRail: string,
  instructions: Record<string, unknown>,
  depositMessage: string | null,
  resolveIdentifierLabel: (key: DepositIdentifierLabelKey) => string,
  resolveDepositMessageLabel: () => string,
): CardDepositCopyBlock | null {
  const identifiers = getCardDepositIdentifiers(paymentRail, instructions);
  const lines: string[] = [];

  for (const row of identifiers) {
    lines.push(`${resolveIdentifierLabel(row.labelKey)}: ${row.value}`);
  }

  if (depositMessage) {
    lines.push(`${resolveDepositMessageLabel()}: ${depositMessage}`);
  }

  if (lines.length === 0) {
    return null;
  }

  if (lines.length === 1 && identifiers.length === 1 && !depositMessage) {
    const row = identifiers[0];
    if (!row) {
      return null;
    }
    return {
      label: resolveIdentifierLabel(row.labelKey),
      copyText: row.value,
      multiline: false,
    };
  }

  return {
    label: null,
    copyText: lines.join('\n'),
    multiline: true,
  };
}

/** Single copyable block for account/transfer cards. */
export function getCardDepositCopyBlock(
  paymentRail: string,
  instructions: Record<string, unknown>,
  resolveLabel: (key: DepositIdentifierLabelKey) => string,
): CardDepositCopyBlock | null {
  const identifiers = getCardDepositIdentifiers(paymentRail, instructions);
  if (identifiers.length === 0) {
    return null;
  }

  if (identifiers.length === 1) {
    const row = identifiers[0];
    if (!row) {
      return null;
    }
    return {
      label: resolveLabel(row.labelKey),
      copyText: row.value,
      multiline: false,
    };
  }

  return {
    label: null,
    copyText: identifiers
      .map((row) => `${resolveLabel(row.labelKey)}: ${row.value}`)
      .join('\n'),
    multiline: true,
  };
}

export function getPrimaryDepositIdentifier(
  paymentRail: string,
  instructions: Record<string, unknown>,
): PrimaryDepositIdentifier | null {
  const rows = getCardDepositIdentifiers(paymentRail, instructions);
  return rows[0] ?? null;
}

export type DepositInstructionBlock = {
  id: string;
  labelKey: string;
  value: string;
};

/** Split detail blocks so the reference message sits directly under card identifiers (IBAN, etc.). */
export function splitInstructionBlocksForTransferReference(
  blocks: DepositInstructionBlock[],
  paymentRail: string,
): {
  leading: DepositInstructionBlock[];
  trailing: DepositInstructionBlock[];
} {
  const rail = normalizePaymentRailForDisplay(paymentRail);
  const anchorId =
    rail === 'ach' || rail === 'wire' || rail === 'faster_payments'
      ? 'accountNumber'
      : 'primaryAccount';

  const anchorIndex = blocks.findIndex((block) => block.id === anchorId);
  if (anchorIndex === -1) {
    return { leading: blocks, trailing: [] };
  }

  return {
    leading: blocks.slice(0, anchorIndex + 1),
    trailing: blocks.slice(anchorIndex + 1),
  };
}

export function getBankInstructionBlocks(
  paymentRail: string,
  instructions: Record<string, unknown>,
): DepositInstructionBlock[] {
  const blocks: DepositInstructionBlock[] = [];
  const rail = normalizePaymentRailForDisplay(paymentRail);

  const accountHolder = readInstructionString(instructions, [
    'account_holder_name',
    'account_holder',
    'bank_account_holder_name',
  ]);
  if (accountHolder) {
    blocks.push({
      id: 'accountHolder',
      labelKey: 'accountHolder',
      value: accountHolder,
    });
  }

  const beneficiaryName = readInstructionString(instructions, [
    'bank_beneficiary_name',
    'beneficiary_name',
    'beneficiary',
  ]);
  const beneficiaryAddress = readInstructionString(instructions, [
    'bank_beneficiary_address',
    'beneficiary_address',
  ]);
  const beneficiaryBlock = combineInstructionLines([
    beneficiaryName,
    beneficiaryAddress,
  ]);
  if (beneficiaryBlock) {
    blocks.push({
      id: 'beneficiary',
      labelKey: 'beneficiaryNameAndAddress',
      value: beneficiaryBlock,
    });
  }

  if (rail === 'ach' || rail === 'wire') {
    const routing = readRoutingNumber(instructions);
    if (routing) {
      blocks.push({
        id: 'routingNumber',
        labelKey: 'routingNumber',
        value: routing,
      });
    }
    const accountNumber = readAccountNumber(instructions);
    if (accountNumber) {
      blocks.push({
        id: 'accountNumber',
        labelKey: 'accountNumber',
        value: accountNumber,
      });
    }
  } else if (rail === 'faster_payments') {
    const sortCode = readSortCode(instructions);
    if (sortCode) {
      blocks.push({ id: 'sortCode', labelKey: 'sortCode', value: sortCode });
    }
    const accountNumber = readAccountNumber(instructions);
    if (accountNumber) {
      blocks.push({
        id: 'accountNumber',
        labelKey: 'accountNumber',
        value: accountNumber,
      });
    }
  } else {
    const primary = getPrimaryDepositIdentifier(paymentRail, instructions);
    if (primary) {
      blocks.push({
        id: 'primaryAccount',
        labelKey: primary.labelKey,
        value: primary.value,
      });
    }
  }

  const swift = readInstructionString(instructions, [
    'bic',
    'swift',
    'swift_code',
  ]);
  if (swift) {
    blocks.push({ id: 'swift', labelKey: 'bicInternational', value: swift });
  }

  const bankName = readInstructionString(instructions, ['bank_name']);
  const bankAddress = readInstructionString(instructions, [
    'bank_address',
    'bank_street_address',
  ]);
  const bankBlock = combineInstructionLines([bankName, bankAddress]);
  if (bankBlock) {
    blocks.push({
      id: 'bank',
      labelKey: 'bankNameAndAddress',
      value: bankBlock,
    });
  }

  return blocks;
}

export function getDepositMessage(
  instructions: Record<string, unknown>,
  depositMessage?: string | null,
): string | null {
  return (
    depositMessage ?? readInstructionString(instructions, ['deposit_message'])
  );
}

export function getDeveloperFeeDisplay(
  instructions: Record<string, unknown>,
): string | null {
  const percent = readInstructionString(instructions, [
    'developer_fee_percent',
    'developer_fee_percentage',
  ]);
  if (percent != null && percent !== '') {
    return percent.includes('%') ? percent : `${percent}%`;
  }

  const flat = readInstructionString(instructions, [
    'developer_fee',
    'developer_fee_amount',
  ]);
  return flat;
}

export function getDestinationFromInstructions(
  instructions: Record<string, unknown>,
  destinationAddress: string,
): {
  currency: string;
  paymentRail: string;
  address: string;
} | null {
  const snapshot = readBridgeTransferSnapshot(instructions);
  const address =
    snapshot?.destination?.toAddress?.trim() ||
    destinationAddress?.trim() ||
    '';

  if (!address) {
    return null;
  }

  const currency =
    snapshot?.destination?.currency ??
    readInstructionString(instructions, ['destination_currency']) ??
    'usdc';
  const paymentRail =
    snapshot?.destination?.paymentRail ??
    readInstructionString(instructions, ['destination_payment_rail']) ??
    'base';

  return {
    currency,
    paymentRail,
    address,
  };
}

const TREASURY_DESTINATION_TOKEN_ICONS: Record<string, string> = {
  usdc: '/placeholder/usdc-icon.svg',
  eurc: '/placeholder/eurc-icon.svg',
};

/** Treasury wallet tab uses the same token icons (USDC / EURC). */
export function getTreasuryDestinationTokenIcon(currency: string): string {
  const key = currency.trim().toLowerCase();
  return TREASURY_DESTINATION_TOKEN_ICONS[key] ?? '/placeholder/usdc-icon.svg';
}

export function formatPaymentRailLabel(rail: string): string {
  if (rail.toLowerCase() === 'base') {
    return 'Base';
  }
  return rail.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatBankInstructionsCopyText({
  blocks,
  depositMessage,
  amount,
  resolveLabel,
}: {
  blocks: DepositInstructionBlock[];
  depositMessage?: string | null;
  amount?: { label: string; value: string } | null;
  resolveLabel: (key: string) => string;
}): string {
  const lines: string[] = [];

  for (const block of blocks) {
    lines.push(`${resolveLabel(block.labelKey)}:`, block.value, '');
  }

  if (depositMessage) {
    lines.push(`${resolveLabel('depositMessage')}: ${depositMessage}`, '');
  }

  if (amount) {
    lines.push(`${amount.label}: ${amount.value}`, '');
  }

  return lines.join('\n').trim();
}

export function formatDepositInstructionsShareText({
  title,
  blocks,
  depositMessage,
  destination,
  fees,
  resolveLabel,
}: {
  title: string;
  blocks: DepositInstructionBlock[];
  depositMessage?: string | null;
  destination?: {
    currency: string;
    rail: string;
    address: string;
  };
  fees?: string | null;
  resolveLabel: (key: string) => string;
}): string {
  const lines: string[] = [title, ''];

  if (depositMessage) {
    lines.push(`${resolveLabel('depositMessage')}: ${depositMessage}`, '');
  }

  for (const block of blocks) {
    lines.push(`${resolveLabel(block.labelKey)}:`, block.value, '');
  }

  if (destination) {
    lines.push(
      `${resolveLabel('treasurySection')}:`,
      `${resolveLabel(
        'destinationCurrency',
      )}: ${destination.currency.toUpperCase()}`,
      `${resolveLabel('destinationRail')}: ${destination.rail}`,
      `${resolveLabel('destinationAddress')}: ${destination.address}`,
      '',
    );
  }

  if (fees != null && fees !== '') {
    lines.push(`${resolveLabel('hyphaFees')}: ${fees}`, '');
  }

  return lines.join('\n').trim();
}

const BRIDGE_RECEIPT_STORAGE_KEY = 'bridge_receipt';
const BRIDGE_SNAPSHOT_STORAGE_KEY = 'bridge_transfer_snapshot';

export type BridgeTransferReceiptDisplay = {
  initialAmount?: string;
  finalAmount?: string;
  subtotalAmount?: string;
  gasFee?: string;
  exchangeFee?: string;
  developerFee?: string;
  destinationTxHash?: string;
  receiptUrl?: string;
};

export type BridgeTransferSnapshotDisplay = {
  id?: string;
  state?: string;
  currency?: string;
  amount?: string;
  developerFee?: string;
  source?: { paymentRail?: string; currency?: string };
  destination?: {
    paymentRail?: string;
    currency?: string;
    toAddress?: string;
  };
  receipt?: BridgeTransferReceiptDisplay;
  createdAt?: string;
  updatedAt?: string;
};

export function readBridgeTransferReceipt(
  depositInstructions: Record<string, unknown>,
): BridgeTransferReceiptDisplay | null {
  const raw = depositInstructions[BRIDGE_RECEIPT_STORAGE_KEY];
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const read = (key: string) => {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const receipt: BridgeTransferReceiptDisplay = {
    initialAmount: read('initial_amount'),
    finalAmount: read('final_amount'),
    subtotalAmount: read('subtotal_amount'),
    gasFee: read('gas_fee'),
    exchangeFee: read('exchange_fee'),
    developerFee: read('developer_fee'),
    destinationTxHash: read('destination_tx_hash'),
    receiptUrl: read('url'),
  };

  return Object.values(receipt).some(Boolean) ? receipt : null;
}

function readReceiptFromRecord(
  raw: Record<string, unknown>,
): BridgeTransferReceiptDisplay | null {
  const read = (key: string) => {
    const value = raw[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const receipt: BridgeTransferReceiptDisplay = {
    initialAmount: read('initial_amount'),
    finalAmount: read('final_amount'),
    subtotalAmount: read('subtotal_amount'),
    gasFee: read('gas_fee'),
    exchangeFee: read('exchange_fee'),
    developerFee: read('developer_fee'),
    destinationTxHash: read('destination_tx_hash'),
    receiptUrl: read('url'),
  };

  return Object.values(receipt).some(Boolean) ? receipt : null;
}

export function readBridgeTransferSnapshot(
  depositInstructions: Record<string, unknown>,
): BridgeTransferSnapshotDisplay | null {
  const raw = depositInstructions[BRIDGE_SNAPSHOT_STORAGE_KEY];
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const readString = (key: string) => {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const readNested = (key: 'source' | 'destination') => {
    const value = record[key];
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    const nested = value as Record<string, unknown>;
    const paymentRail =
      typeof nested.payment_rail === 'string' ? nested.payment_rail : undefined;
    const currency =
      typeof nested.currency === 'string' ? nested.currency : undefined;
    const toAddress =
      typeof nested.to_address === 'string' ? nested.to_address : undefined;
    if (!paymentRail && !currency && !toAddress) {
      return undefined;
    }
    return key === 'destination'
      ? { paymentRail, currency, toAddress }
      : { paymentRail, currency };
  };

  const snapshot: BridgeTransferSnapshotDisplay = {
    id: readString('id'),
    state: readString('state'),
    currency: readString('currency'),
    amount: readString('amount'),
    developerFee: readString('developer_fee'),
    source: readNested('source') as BridgeTransferSnapshotDisplay['source'],
    destination: readNested(
      'destination',
    ) as BridgeTransferSnapshotDisplay['destination'],
    createdAt: readString('created_at'),
    updatedAt: readString('updated_at'),
  };

  if (typeof record.receipt === 'object' && record.receipt !== null) {
    snapshot.receipt =
      readReceiptFromRecord(record.receipt as Record<string, unknown>) ??
      undefined;
  }

  return snapshot.id || snapshot.state || snapshot.receipt ? snapshot : null;
}

export function getCompletedTransferIban(
  depositInstructions: Record<string, unknown>,
): string | null {
  return readInstructionString(depositInstructions, ['iban']);
}

export type CompletedTransferReferenceRow = {
  labelKey: 'iban' | 'depositMessage' | 'amount';
  value: string;
};

/** Minimal reference fields for completed transfers (IBAN when present, reference, amount). */
export function getCompletedTransferReferenceRows(
  transfer: {
    paymentRail: string;
    depositInstructions: Record<string, unknown>;
    depositMessage: string | null;
    amount: string | null;
    currency: string;
  },
  resolveAmountLabel: (amount: string | null, currency: string) => string,
): CompletedTransferReferenceRow[] {
  const rows: CompletedTransferReferenceRow[] = [];
  const iban = readInstructionString(transfer.depositInstructions, ['iban']);

  if (iban) {
    rows.push({ labelKey: 'iban', value: iban });
  }

  const depositMessage = getDepositMessage(
    transfer.depositInstructions,
    transfer.depositMessage,
  );
  if (depositMessage) {
    rows.push({ labelKey: 'depositMessage', value: depositMessage });
  }

  rows.push({
    labelKey: 'amount',
    value: resolveAmountLabel(transfer.amount, transfer.currency),
  });

  return rows;
}

export function formatCompletedTransferReferenceText(
  rows: CompletedTransferReferenceRow[],
  resolveLabel: (key: CompletedTransferReferenceRow['labelKey']) => string,
): string {
  return rows
    .map((row) => `${resolveLabel(row.labelKey)}: ${row.value}`)
    .join('\n');
}
