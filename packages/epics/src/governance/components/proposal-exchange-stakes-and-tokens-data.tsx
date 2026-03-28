'use client';

import { useTranslations } from 'next-intl';
import { EthAddress } from '../../people';

interface ExchangeLeg {
  from: string;
  to: string;
  tokenAddress: string;
  tokenSymbol?: string;
  amount: bigint;
  funded?: boolean;
}

interface ProposalExchangeStakesAndTokensDataProps {
  legs: ExchangeLeg[];
  escrowId?: bigint;
  completed?: boolean;
  cancelled?: boolean;
  spaceSlug: string;
}

export const ProposalExchangeStakesAndTokensData = ({
  legs,
  escrowId,
  completed,
  cancelled,
  spaceSlug,
}: ProposalExchangeStakesAndTokensDataProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  void spaceSlug;

  const status = completed
    ? tProposalDetails('exchange.status.completed')
    : cancelled
    ? tProposalDetails('exchange.status.cancelled')
    : tProposalDetails('exchange.status.pendingFunding');

  return (
    <div className="flex flex-col gap-4">
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
      {legs.map((leg, index) => {
        return (
          <div
            key={`${leg.from}-${leg.to}-${leg.tokenAddress}-${index}`}
            className="rounded-md border border-neutral-6 p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-2 text-neutral-11">
                {tProposalDetails('exchange.leg')}
              </span>
              <span className="text-2">
                {leg.amount.toString()} {leg.tokenSymbol ?? leg.tokenAddress}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2 text-neutral-11">
                {tProposalDetails('labels.token')}
              </span>
              <EthAddress address={leg.tokenAddress} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2 text-neutral-11">
                {tProposalDetails('exchange.from')}
              </span>
              <EthAddress address={leg.from} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2 text-neutral-11">
                {tProposalDetails('exchange.to')}
              </span>
              <EthAddress address={leg.to} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2 text-neutral-11">
                {tProposalDetails('exchange.funded')}
              </span>
              <span className="text-2">
                {leg.funded
                  ? tProposalDetails('labels.yes')
                  : tProposalDetails('labels.no')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
