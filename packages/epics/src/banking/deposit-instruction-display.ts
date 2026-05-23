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
    case 'ach': {
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

  if (rail === 'ach') {
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
  if (!destinationAddress) {
    return null;
  }

  const currency =
    readInstructionString(instructions, ['destination_currency']) ?? 'usdc';
  const paymentRail =
    readInstructionString(instructions, ['destination_payment_rail']) ?? 'base';

  return {
    currency,
    paymentRail,
    address: destinationAddress,
  };
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
  resolveLabel,
}: {
  blocks: DepositInstructionBlock[];
  depositMessage?: string | null;
  resolveLabel: (key: string) => string;
}): string {
  const lines: string[] = [];

  if (depositMessage) {
    lines.push(`${resolveLabel('depositMessage')}: ${depositMessage}`, '');
  }

  for (const block of blocks) {
    lines.push(`${resolveLabel(block.labelKey)}:`, block.value, '');
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
