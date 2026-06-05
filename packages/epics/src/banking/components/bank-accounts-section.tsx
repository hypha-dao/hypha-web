'use client';

import { FC, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

import { ApprovedBankingDeposits } from './approved-banking-deposits';
import type { ApprovedBankingDepositsProps } from './approved-banking-deposits';

type OpenSpaceAccountDisabledReason =
  | 'loadingAccounts'
  | 'finishVerificationFirst'
  | 'allCurrenciesCovered'
  | null;

type BankAccountsSectionProps = {
  isAuthenticated: boolean;
  canManage: boolean;
  depositsProps: ApprovedBankingDepositsProps;
  onOpenSpaceAccount: () => void;
  openSpaceAccountDisabled?: boolean;
  openSpaceAccountDisabledReason?: OpenSpaceAccountDisabledReason;
  /** Advanced (gear) control, rendered to the right of the primary button. */
  gearSlot?: ReactNode;
  /** Parent shows page skeleton while lists load. */
  hideListLoadingState?: boolean;
};

export const BankAccountsSection: FC<BankAccountsSectionProps> = ({
  isAuthenticated,
  canManage,
  depositsProps,
  onOpenSpaceAccount,
  openSpaceAccountDisabled = false,
  openSpaceAccountDisabledReason = null,
  gearSlot,
  hideListLoadingState = false,
}) => {
  const t = useTranslations('BankingTab.sections.accounts');
  const tToolbar = useTranslations('BankingTab.toolbar');

  const showOpenButton = canManage && isAuthenticated;
  const buttonDisabled = openSpaceAccountDisabled;
  const tooltipText =
    openSpaceAccountDisabledReason === 'loadingAccounts'
      ? tToolbar('loadingAccounts')
      : openSpaceAccountDisabledReason === 'finishVerificationFirst'
      ? tToolbar('finishVerificationFirst')
      : openSpaceAccountDisabledReason === 'allCurrenciesCovered'
      ? tToolbar('allCurrenciesCovered')
      : null;

  const openButton = (
    <Button
      type="button"
      colorVariant="accent"
      variant="outline"
      className="shrink-0"
      disabled={buttonDisabled}
      onClick={onOpenSpaceAccount}
    >
      {tToolbar('addCurrency')}
    </Button>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-3 font-semibold tracking-tight text-foreground">
            {t('title')}
          </h4>
          <p className="mt-1 max-w-3xl text-2 text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showOpenButton ? (
            tooltipText && buttonDisabled ? (
              <span className="inline-flex" title={tooltipText}>
                {openButton}
              </span>
            ) : (
              openButton
            )
          ) : null}
          {gearSlot}
        </div>
      </div>

      {!isAuthenticated ? (
        <p className="text-2 text-muted-foreground">{t('signInHint')}</p>
      ) : (
        <ApprovedBankingDeposits
          {...depositsProps}
          hideLoadingState={hideListLoadingState}
        />
      )}
    </section>
  );
};
