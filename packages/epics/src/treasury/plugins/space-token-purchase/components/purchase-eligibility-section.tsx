'use client';

import { FormLabel } from '@hypha-platform/ui';

type SpaceToken = {
  name: string;
};

type PurchaseEligibilitySectionProps = {
  selectedToken: SpaceToken | undefined;
};

export const PurchaseEligibilitySection = ({
  selectedToken,
}: PurchaseEligibilitySectionProps) => {
  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Purchase Eligibility</FormLabel>
      <span className="text-2 text-neutral-11">
        The &quot;Buy Space tokens&quot; button will be shown on the profile of
        the spaces or members which are whitelisted in the token settings. If
        you&apos;d like to review this access, you can manage whitelists by
        passing a token configuration proposal.
      </span>
      {selectedToken && (
        <div className="flex flex-col gap-2 p-3 rounded-md bg-neutral-2 border border-neutral-6">
          <span className="text-2 text-neutral-11">
            Whitelist is configured in the token&apos;s original issuance
            settings. All members or spaces in the &quot;To&quot; whitelist will
            be able to see and purchase <strong>{selectedToken.name}</strong>{' '}
            tokens.
          </span>
        </div>
      )}
    </div>
  );
};
