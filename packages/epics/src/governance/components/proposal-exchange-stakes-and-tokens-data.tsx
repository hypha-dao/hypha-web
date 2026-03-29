'use client';

import { useTranslations } from 'next-intl';
import { EthAddress } from '../../people';
import { usePersonByWeb3Address } from '../hooks';
import { TokenLabel } from './token-label';
import { Image } from '@hypha-platform/ui';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

const isEvmAddress = (value?: string): value is `0x${string}` =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

const getPreferredAddress = (
  primary?: string,
  fallback?: string,
): string | undefined => {
  if (isEvmAddress(primary)) return primary;
  if (isEvmAddress(fallback)) return fallback;
  return primary || fallback;
};

interface ProposalExchangeStakesAndTokensDataProps {
  spaceSlug?: string;
  sellerAddress?: string;
  buyerAddress?: string;
  fallbackSellerAddress?: string;
  fallbackBuyerAddress?: string;
  sellerLeg: Array<{
    amount: string;
    tokenAddress: string;
  }>;
  buyerLeg: Array<{
    amount: string;
    tokenAddress: string;
  }>;
  escrowId?: bigint;
  completed?: boolean;
  cancelled?: boolean;
}

export const ProposalExchangeStakesAndTokensData = ({
  spaceSlug,
  sellerAddress,
  buyerAddress,
  fallbackSellerAddress,
  fallbackBuyerAddress,
  sellerLeg,
  buyerLeg,
}: ProposalExchangeStakesAndTokensDataProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const resolvedSellerAddress = getPreferredAddress(
    sellerAddress,
    fallbackSellerAddress,
  );
  const resolvedBuyerAddress = getPreferredAddress(
    buyerAddress,
    fallbackBuyerAddress,
  );
  const { person: sellerPerson } = usePersonByWeb3Address(
    resolvedSellerAddress && isEvmAddress(resolvedSellerAddress)
      ? resolvedSellerAddress
      : ZERO_ADDRESS,
  );
  const { person: buyerPerson } = usePersonByWeb3Address(
    resolvedBuyerAddress && isEvmAddress(resolvedBuyerAddress)
      ? resolvedBuyerAddress
      : ZERO_ADDRESS,
  );

  const renderPartyValue = (
    address?: string,
    label?: string,
    avatarUrl?: string,
    avatarAlt?: string,
  ) => {
    if (label) {
      return (
        <span className="flex gap-2 text-2 text-neutral-11">
          <Image
            className="rounded-lg w-[24px] h-[24px]"
            src={avatarUrl ?? '/placeholder/default-profile.svg'}
            width={24}
            height={24}
            alt={avatarAlt ?? 'avatar'}
          />
          <span className="text-nowrap">{label}</span>
        </span>
      );
    }
    if (isEvmAddress(address)) {
      return <EthAddress address={address} />;
    }
    return <span className="text-2">-</span>;
  };

  const renderLegRows = (
    rows: Array<{
      amount: string;
      tokenAddress: string;
    }>,
  ) => {
    if (!rows.length) {
      return <span className="text-2">-</span>;
    }

    return rows.map((leg, index) => (
      <div key={`${leg.tokenAddress}-${index}`} className="text-2">
        {spaceSlug ? (
          <TokenLabel
            tokenAddress={leg.tokenAddress as `0x${string}`}
            spaceSlug={spaceSlug}
          />
        ) : (
          <EthAddress address={leg.tokenAddress} />
        )}
      </div>
    ));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.seller')}
        </span>
        {renderPartyValue(
          resolvedSellerAddress,
          sellerPerson
            ? `${sellerPerson.name} ${sellerPerson.surname}`
            : undefined,
          sellerPerson?.avatarUrl,
          `${sellerPerson?.nickname ?? 'seller'} avatar`,
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.sellerWillSend')}
        </span>
        <div className="flex flex-col items-end">
          {renderLegRows(sellerLeg)}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.buyer')}
        </span>
        {renderPartyValue(
          resolvedBuyerAddress,
          buyerPerson
            ? `${buyerPerson.name} ${buyerPerson.surname}`
            : undefined,
          buyerPerson?.avatarUrl,
          `${buyerPerson?.nickname ?? 'buyer'} avatar`,
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.buyerWillSend')}
        </span>
        <div className="flex flex-col items-end">
          {renderLegRows(buyerLeg)}
        </div>
      </div>
    </div>
  );
};
