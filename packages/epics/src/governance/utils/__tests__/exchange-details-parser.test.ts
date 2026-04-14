import { describe, expect, it } from 'vitest';
import { parseExchangeDetailsFromDescription } from '../exchange-details-parser';

describe('parseExchangeDetailsFromDescription', () => {
  it('parses seller and buyer legs when headings use **Label:** (not **Label**)', () => {
    const description = `User note

<!-- exchange-details:start -->
### Exchange

**Seller (Wallet Address):** \`0x1111111111111111111111111111111111111111\`

**Seller sends:**
- 1. 1 | \`0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\`

**Buyer (Wallet Address):** \`0x2222222222222222222222222222222222222222\`

**Buyer will send:**
- 1. 2 | \`0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\`
<!-- exchange-details:end -->
`;

    const parsed = parseExchangeDetailsFromDescription(description);
    expect(parsed).not.toBeNull();
    expect(parsed!.sellerLeg).toEqual([
      {
        amount: '1',
        tokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ]);
    expect(parsed!.buyerLeg).toEqual([
      {
        amount: '2',
        tokenAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    ]);
  });
});
