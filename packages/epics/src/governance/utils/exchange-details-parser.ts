const EXCHANGE_DETAILS_START = '<!-- exchange-details:start -->';
const EXCHANGE_DETAILS_END = '<!-- exchange-details:end -->';

export type ParsedExchangeLeg = {
  amount: string;
  tokenAddress: string;
};

export type ParsedExchangeDetails = {
  sellerAddress?: string;
  buyerAddress?: string;
  sellerLeg: ParsedExchangeLeg[];
  buyerLeg: ParsedExchangeLeg[];
};

const parseAddressFromLine = (line: string): string | undefined => {
  // Leg rows use backticks around the token; do not treat them as party wallets.
  if (line.trimStart().startsWith('- ')) return undefined;
  const open = line.indexOf('`0x');
  if (open === -1) return undefined;
  const addrStart = open + 1;
  const close = line.indexOf('`', addrStart + 1);
  if (close === -1) return undefined;
  const inner = line.slice(addrStart, close);
  return /^0x[a-fA-F0-9]{40}$/.test(inner) ? inner : undefined;
};

/**
 * Parses `- [n.] amount | 0x...` lines without regex backtracking (ReDoS-safe).
 */
const parseLegLine = (line: string): ParsedExchangeLeg | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('- ')) return null;

  let rest = trimmed.slice(2).trim();
  const numMatch = /^(\d+)\.\s+/.exec(rest);
  if (numMatch) {
    rest = rest.slice(numMatch[0].length);
  }

  const pipeIdx = rest.indexOf('|');
  if (pipeIdx === -1) return null;

  const amountPart = rest.slice(0, pipeIdx).trim();
  let tokenPart = rest.slice(pipeIdx + 1).trim();
  if (tokenPart.startsWith('`')) {
    tokenPart = tokenPart.slice(1);
  }
  if (tokenPart.endsWith('`')) {
    tokenPart = tokenPart.slice(0, -1);
  }

  if (!amountPart || !/^0x[a-fA-F0-9]{40}$/i.test(tokenPart)) {
    return null;
  }

  return {
    amount: amountPart,
    tokenAddress: tokenPart,
  };
};

export const parseExchangeDetailsFromDescription = (
  description?: string | null,
): ParsedExchangeDetails | null => {
  if (!description) return null;

  const startIndex = description.indexOf(EXCHANGE_DETAILS_START);
  const endIndex = description.indexOf(EXCHANGE_DETAILS_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const section = description
    .slice(startIndex + EXCHANGE_DETAILS_START.length, endIndex)
    .trim();
  const lines = section.split('\n').map((line) => line.trim());

  let sellerAddress: string | undefined;
  let buyerAddress: string | undefined;
  const sellerLeg: ParsedExchangeLeg[] = [];
  const buyerLeg: ParsedExchangeLeg[] = [];

  let currentLeg: 'seller' | 'buyer' | null = null;
  let legHeadingCount = 0;

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith('###')) {
      continue;
    }

    const parsedAddress = parseAddressFromLine(line);
    if (parsedAddress) {
      if (!sellerAddress) {
        sellerAddress = parsedAddress;
      } else if (!buyerAddress) {
        buyerAddress = parsedAddress;
      }
      currentLeg = null;
      continue;
    }

    const isLegHeading =
      line.startsWith('**') && line.endsWith('**') && !line.includes('`0x');
    if (isLegHeading) {
      legHeadingCount += 1;
      currentLeg = legHeadingCount === 1 ? 'seller' : 'buyer';
      continue;
    }

    if (
      line.toLowerCase().includes('seller will send') ||
      line.toLowerCase().includes('buyer will send')
    ) {
      currentLeg = line.toLowerCase().includes('seller') ? 'seller' : 'buyer';
      continue;
    }

    if (line.toLowerCase().includes('buyer will send')) {
      currentLeg = 'buyer';
      continue;
    }

    if (line.startsWith('- ')) {
      const parsedLeg = parseLegLine(line);
      if (!parsedLeg) continue;
      if (currentLeg === 'seller') {
        sellerLeg.push(parsedLeg);
      } else if (currentLeg === 'buyer') {
        buyerLeg.push(parsedLeg);
      }
    }
  }

  if (
    !sellerAddress &&
    !buyerAddress &&
    sellerLeg.length === 0 &&
    buyerLeg.length === 0
  ) {
    return null;
  }

  return { sellerAddress, buyerAddress, sellerLeg, buyerLeg };
};
