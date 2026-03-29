'use client';

import { useTranslations } from 'next-intl';
import { EthAddress } from '../../people';
import { usePersonByWeb3Address } from '../hooks';

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
  sellerAddress,
  buyerAddress,
  fallbackSellerAddress,
  fallbackBuyerAddress,
  sellerLeg,
  buyerLeg,
  escrowId,
  completed,
  cancelled,
}: ProposalExchangeStakesAndTokensDataProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
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

  const status = completed
    ? tProposalDetails('exchange.status.completed')
    : cancelled
    ? tProposalDetails('exchange.status.cancelled')
    : tProposalDetails('exchange.status.pendingFunding');

  const renderPartyValue = (address?: string, label?: string) => {
    if (label) {
      return <span className="text-2">{label}</span>;
    }
    if (isEvmAddress(address)) {
      return <EthAddress address={address} />;
    }
    return <span className="text-2">{tProposalDetails('labels.unknown')}</span>;
  };

  const renderLegRows = (
    rows: Array<{
      amount: string;
      tokenAddress: string;
    }>,
  ) => {
    if (!rows.length) {
      return (
        <span className="text-2">{tProposalDetails('labels.unknown')}</span>
      );
    }

    return rows.map((leg, index) => (
      <div
        key={`${leg.tokenAddress}-${index}`}
        className="flex items-center justify-between text-2"
      >
        <span>[{leg.amount}]</span>
        {isEvmAddress(leg.tokenAddress) ? (
          <EthAddress address={leg.tokenAddress} />
        ) : (
          <span>{leg.tokenAddress}</span>
        )}
      </div>
    ));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.seller')}
        </span>
        {renderPartyValue(
          resolvedSellerAddress,
          sellerPerson
            ? `${sellerPerson.name} ${sellerPerson.surname}`
            : undefined,
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-neutral-6 p-3">
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.sellerWillSend')}
        </span>
        {renderLegRows(sellerLeg)}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.buyer')}
        </span>
        {renderPartyValue(
          resolvedBuyerAddress,
          buyerPerson
            ? `${buyerPerson.name} ${buyerPerson.surname}`
            : undefined,
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-neutral-6 p-3">
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.buyerWillSend')}
        </span>
        {renderLegRows(buyerLeg)}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2 text-neutral-11">
          {tProposalDetails('exchange.escrowId')}
        </span>
        <span className="text-2">
          {escrowId ? escrowId.toString() : tProposalDetails('labels.unknown')}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2 text-neutral-11">
          {tProposalDetails('exchange.status.label')}
        </span>
        <span className="text-2">{status}</span>
      </div>
    </div>
  );
};
