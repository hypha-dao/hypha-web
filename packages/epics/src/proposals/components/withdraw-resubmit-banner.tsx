'use client';

import { Button, ConfirmDialog } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

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
  const tProposalDetails = useTranslations('ProposalDetails');
  return (
    <div className="rounded-[8px] p-5 border-1 bg-accent-surface border-accent-6 bg-center flex flex-col gap-4">
      <span className="text-2 text-foreground font-bold">
        {tProposalDetails('withdrawResubmit.title')}
      </span>
      <div className="flex gap-2">
        <ConfirmDialog
          title={tProposalDetails('withdrawResubmit.withdrawDialogTitle')}
          description={tProposalDetails(
            'withdrawResubmit.withdrawDialogDescription',
          )}
          customAcceptButtonText={tProposalDetails('withdrawResubmit.withdraw')}
          customRejectButtonText={tProposalDetails('withdrawResubmit.cancel')}
          onAcceptClicked={onWithdraw}
          isLoading={isWithdrawing}
        >
          <Button
            variant="outline"
            colorVariant="accent"
            disabled={isWithdrawing}
          >
            {isWithdrawing
              ? tProposalDetails('withdrawResubmit.withdrawing')
              : tProposalDetails('withdrawResubmit.withdraw')}
          </Button>
        </ConfirmDialog>
        <ConfirmDialog
          title={tProposalDetails('withdrawResubmit.resubmitDialogTitle')}
          description={tProposalDetails(
            'withdrawResubmit.resubmitDialogDescription',
          )}
          customAcceptButtonText={tProposalDetails('withdrawResubmit.resubmit')}
          customRejectButtonText={tProposalDetails('withdrawResubmit.cancel')}
          onAcceptClicked={onResubmit}
          isLoading={isWithdrawing}
        >
          <Button
            variant="outline"
            colorVariant="accent"
            disabled={isWithdrawing}
          >
            {isWithdrawing
              ? tProposalDetails('withdrawResubmit.processing')
              : tProposalDetails('withdrawResubmit.resubmit')}
          </Button>
        </ConfirmDialog>
      </div>
    </div>
  );
};
