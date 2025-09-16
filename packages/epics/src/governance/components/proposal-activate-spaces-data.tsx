'use client';

import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useSpacesByWeb3Ids } from '../hooks';
import { Image, Separator } from '@hypha-platform/ui';

interface ProposalActivateSpacesDataProps {
  spaceIds?: bigint[];
  paymentAmounts?: bigint[];
  tokenSymbol?: string;
}

const HYPHA_PRICE_USD = 0.25;
const HYPHA_PER_MONTH = 44;
const USDC_PER_MONTH = 11;

export const ProposalActivateSpacesData = ({
  spaceIds,
  paymentAmounts,
  tokenSymbol,
}: ProposalActivateSpacesDataProps) => {
  const { spaces } = useSpacesByWeb3Ids(spaceIds ?? [], false);

  const getMonthsCount = (
    amount: bigint | undefined,
    token: string | undefined,
  ): number => {
    if (!amount || !token) return 0;

    let decimals: number;
    let pricePerMonth: number;

    if (token === 'USDC') {
      decimals = 6;
      pricePerMonth = USDC_PER_MONTH;
    } else if (token === 'HYPHA') {
      decimals = 18;
      pricePerMonth = HYPHA_PER_MONTH;
    } else {
      return 0;
    }

    const humanAmount = Number(amount) / 10 ** decimals;
    return Math.floor(humanAmount / pricePerMonth);
  };

  const getUsdcEquivalent = (
    amount: bigint | undefined,
    token: string | undefined,
  ): number => {
    if (!amount || !token) return 0;

    let usdAmount: number;

    if (token === 'USDC') {
      usdAmount = Number(amount) / 10 ** 6;
    } else if (token === 'HYPHA') {
      const hyphaAmount = Number(amount) / 10 ** 18;
      usdAmount = hyphaAmount * HYPHA_PRICE_USD;
    } else {
      return 0;
    }

    return usdAmount;
  };

  const totalUsdc =
    paymentAmounts?.reduce(
      (sum, amount) => sum + getUsdcEquivalent(amount, tokenSymbol),
      0,
    ) ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex text-1 text-neutral-11 w-full justify-start">
            Spaces
          </div>
          <div className="flex text-1 text-neutral-11 w-full justify-end">
            Months
          </div>
        </div>
      </div>
      {spaces.map((space, index) => (
        <div key={index} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex text-1 text-neutral-11">
              <Image
                src={space?.logoUrl ?? '/placeholder/space-avatar-image.svg'}
                width={24}
                height={24}
                alt={`Logo for ${space?.title}`}
                className="rounded-full"
              />
            </div>
            <div className="flex text-1 text-neutral-11">{space.title}</div>
          </div>
          <div className="flex text-1 text-neutral-11">
            {getMonthsCount(paymentAmounts?.[index], tokenSymbol)}
          </div>
        </div>
      ))}
      <Separator />
      <div className="flex justify-between items-center">
        <div className="flex text-1 text-neutral-11 w-full justify-start">
          Total Amount
        </div>
        <div className="flex text-1 text-neutral-11 w-full justify-end">
          {formatCurrencyValue(totalUsdc)} USDC
        </div>
      </div>
    </div>
  );
};
