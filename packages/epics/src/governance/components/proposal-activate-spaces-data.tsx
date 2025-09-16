'use client';

import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useSpacesByWeb3Ids } from '../hooks';
import { Image, Separator, Input } from '@hypha-platform/ui';

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

  const getTotalHyphaAmount = (): number => {
    if (tokenSymbol !== 'HYPHA') return 0;

    return (
      paymentAmounts?.reduce(
        (sum, amount) => sum + Number(amount) / 10 ** 18,
        0,
      ) ?? 0
    );
  };

  const totalUsdc =
    paymentAmounts?.reduce(
      (sum, amount) => sum + getUsdcEquivalent(amount, tokenSymbol),
      0,
    ) ?? 0;

  const totalHypha = getTotalHyphaAmount();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex text-2 text-neutral-11 w-full justify-start">
            Spaces
          </div>
          <div className="flex text-2 text-neutral-11 w-full justify-end">
            Months
          </div>
        </div>
      </div>
      {spaces.map((space, index) => (
        <div key={index} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex text-2 text-neutral-11">
              <Image
                src={space?.logoUrl ?? '/placeholder/space-avatar-image.svg'}
                width={24}
                height={24}
                alt={`Logo for ${space?.title}`}
                className="rounded-full min-h-[24px]"
              />
            </div>
            <div className="flex text-2 text-neutral-11">{space.title}</div>
          </div>
          <div className="flex text-2 text-neutral-11">
            {getMonthsCount(paymentAmounts?.[index], tokenSymbol)}
          </div>
        </div>
      ))}
      <Separator />
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex text-2 text-neutral-11 w-full justify-start">
            Pay with
          </div>
          <div className="flex text-2 text-neutral-11 w-full justify-end">
            {tokenSymbol}
          </div>
        </div>
      </div>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11 w-full">
          Total amount in HYPHA
        </span>
        <span className="text-2 text-neutral-11 text-nowrap">
          <Input
            leftIcon={
              <Image
                src="/placeholder/space-avatar-image.svg"
                width={24}
                height={24}
                alt="Hypha Token Icon"
              />
            }
            value={totalHypha.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
            disabled
          />
        </span>
      </div>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11 w-full">
          Total amount in USDC
        </span>
        <span className="text-2 text-neutral-11 text-nowrap">
          <Input
            leftIcon={
              <Image
                src="/placeholder/usdc-icon.svg"
                width={24}
                height={24}
                alt="USDC Icon"
              />
            }
            value={totalUsdc.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
            disabled
          />
        </span>
      </div>
    </div>
  );
};
