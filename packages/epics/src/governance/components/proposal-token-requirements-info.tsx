'use client';

import { TokenLabel } from './token-label';

interface ProposalTokenRequirementsInfoPops {
  token: `0x${string}`;
  amount: bigint;
}

export const ProposalTokenRequirementsInfo = ({
  token,
  amount,
}: ProposalTokenRequirementsInfoPops) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token</div>
        <div className="text-1">
          <TokenLabel tokenAddress={token} />
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Amount</div>
        <div className="text-1">{amount}</div>
      </div>
    </div>
  );
};
