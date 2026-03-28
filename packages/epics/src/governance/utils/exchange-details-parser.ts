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
  const match = line.match(/`(0x[a-fA-F0-9]{40})`/);
  return match?.[1];
};

const parseLegLine = (line: string): ParsedExchangeLeg | null => {
  const match = line.match(/-\s*\d+\.\s*(.+?)\s*\|\s*`(0x[a-fA-F0-9]{40})`/);
  if (!match) return null;

  return {
    amount: match[1]?.trim() ?? '',
    tokenAddress: match[2] ?? '',
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
