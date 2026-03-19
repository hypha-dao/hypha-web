'use client';

import { Button, ConfirmDialog } from '@hypha-platform/ui';

interface WithdrawResubmitBannerProps {
  onWithdraw: () => Promise<void>;
  onResubmit: () => Promise<void>;
  isWithdrawing: boolean;
}

export const WithdrawResubmitBanner = ({
  onWithdraw,
  onResubmit,
  isWithdrawing,
}: WithdrawResubmitBannerProps) => {
  return (
    <div className="rounded-[8px] p-5 border-1 bg-accent-surface border-accent-6 bg-center flex flex-col gap-4">
      <span className="text-2 text-foreground font-bold">
        Withdraw your proposal or edit and submit again?
      </span>
      <div className="flex gap-2">
        <ConfirmDialog
          title="Withdraw Proposal"
          description="Are you sure you want to withdraw this proposal? It will no longer appear on the Proposal screen and cannot be recovered."
          customAcceptButtonText="Withdraw"
          customRejectButtonText="Cancel"
          onAcceptClicked={onWithdraw}
          isLoading={isWithdrawing}
        >
          <Button
            variant="outline"
            colorVariant="accent"
            disabled={isWithdrawing}
          >
            {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        </ConfirmDialog>
        <ConfirmDialog
          title="Resubmit Proposal"
          description="Are you sure you want to resubmit this proposal? The current proposal will be withdrawn, a new one will be created with your content, and votes will be reset."
          customAcceptButtonText="Resubmit"
          customRejectButtonText="Cancel"
          onAcceptClicked={onResubmit}
          isLoading={isWithdrawing}
        >
          <Button
            variant="outline"
            colorVariant="accent"
            disabled={isWithdrawing}
          >
            {isWithdrawing ? 'Processing...' : 'Resubmit'}
          </Button>
        </ConfirmDialog>
      </div>
    </div>
  );
};
