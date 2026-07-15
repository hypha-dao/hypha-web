'use client';

import { FC, ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';

import { ApprovedBankingDeposits } from './approved-banking-deposits';
import type { ApprovedBankingDepositsProps } from './approved-banking-deposits';
import { ApprovedBankingPayouts } from './approved-banking-payouts';
import type { BankPayoutAccountPublic } from '../hooks/types';
import {
  BankTransfersSection,
  type BankTransfersSectionProps,
} from './bank-transfers-section';

type OpenSpaceAccountDisabledReason =
  | 'loadingAccounts'
  | 'finishVerificationFirst'
  | 'allCurrenciesCovered'
  | null;

type BankAccountsSectionProps = {
  isAuthenticated: boolean;
  canManage: boolean;
  depositsProps: ApprovedBankingDepositsProps;
  transfersProps: BankTransfersSectionProps;
  payoutAccounts: BankPayoutAccountPublic[];
  payoutAccountsLoading: boolean;
  onOpenSpaceAccount: () => void;
  onOpenPayoutAccount: () => void;
  onPayoutAccountClick?: (account: BankPayoutAccountPublic) => void;
  openSpaceAccountDisabled?: boolean;
  openSpaceAccountDisabledReason?: OpenSpaceAccountDisabledReason;
  openPayoutAccountDisabled?: boolean;
  openPayoutAccountDisabledReason?: OpenSpaceAccountDisabledReason;
  /** Advanced (gear) control, rendered on the tabs row. */
  gearSlot?: ReactNode;
  /** Parent shows page skeleton while lists load. */
  hideListLoadingState?: boolean;
  /** Selects `.person` sibling copy where it diverges. Defaults to the space wording. */
  ownerContext?: 'space' | 'person';
};

function BankingSubsectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h4 className="text-3 font-semibold tracking-tight text-foreground">
          {title}
        </h4>
        <p className="mt-1 max-w-3xl text-2 text-muted-foreground">
          {description}
        </p>
      </div>
      {action ? (
        <div className="flex shrink-0 items-center">{action}</div>
      ) : null}
    </div>
  );
}

function SectionActionButton({
  label,
  disabled,
  tooltipText,
  onClick,
}: {
  label: string;
  disabled: boolean;
  tooltipText: string | null;
  onClick: () => void;
}) {
  const button = (
    <Button
      type="button"
      colorVariant="accent"
      variant="outline"
      className="shrink-0"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >
      {label}
    </Button>
  );

  if (tooltipText && disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export const BankAccountsSection: FC<BankAccountsSectionProps> = ({
  isAuthenticated,
  canManage,
  depositsProps,
  transfersProps,
  payoutAccounts,
  payoutAccountsLoading,
  onOpenSpaceAccount,
  onOpenPayoutAccount,
  onPayoutAccountClick,
  openSpaceAccountDisabled = false,
  openSpaceAccountDisabledReason = null,
  openPayoutAccountDisabled = false,
  openPayoutAccountDisabledReason = null,
  gearSlot,
  hideListLoadingState = false,
  ownerContext = 'space',
}) => {
  const tAccounts = useTranslations('BankingTab.sections.accounts');
  const tPayouts = useTranslations('BankingTab.payouts');
  const tToolbar = useTranslations('BankingTab.toolbar');

  const isPerson = ownerContext === 'person';
  const accountsDescription = isPerson
    ? tAccounts('person.description')
    : tAccounts('description');
  const payoutsDescription = isPerson
    ? tPayouts('section.person.description')
    : tPayouts('section.description');

  const [activeTab, setActiveTab] = useState<'deposits' | 'payouts'>(
    'deposits',
  );

  const showManageActions = canManage && isAuthenticated;

  const depositAccountTooltip =
    openSpaceAccountDisabledReason === 'loadingAccounts'
      ? tToolbar('loadingAccounts')
      : openSpaceAccountDisabledReason === 'finishVerificationFirst'
      ? tToolbar('finishVerificationFirst')
      : openSpaceAccountDisabledReason === 'allCurrenciesCovered'
      ? tToolbar('allCurrenciesCovered')
      : null;

  const payoutAccountTooltip =
    openPayoutAccountDisabledReason === 'loadingAccounts'
      ? tToolbar('loadingAccounts')
      : openPayoutAccountDisabledReason === 'finishVerificationFirst'
      ? tToolbar('finishVerificationFirst')
      : openPayoutAccountDisabledReason === 'allCurrenciesCovered'
      ? tToolbar('allCurrenciesCovered')
      : null;

  return (
    <section className="flex w-full flex-col gap-6">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'deposits' | 'payouts')}
        className="flex w-full flex-col gap-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList triggerVariant="switch" className="w-fit">
            <TabsTrigger value="deposits" variant="switch">
              {tPayouts('tabs.deposits')}
            </TabsTrigger>
            <TabsTrigger value="payouts" variant="switch">
              {tPayouts('tabs.payouts')}
            </TabsTrigger>
          </TabsList>
          {gearSlot ? (
            <div className="flex shrink-0 items-center">{gearSlot}</div>
          ) : null}
        </div>

        {!isAuthenticated ? (
          <p className="text-2 text-muted-foreground">
            {tAccounts('signInHint')}
          </p>
        ) : activeTab === 'deposits' ? (
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <BankingSubsectionHeader
                title={tAccounts('title')}
                description={accountsDescription}
                action={
                  showManageActions ? (
                    <SectionActionButton
                      label={tToolbar('addCurrency')}
                      disabled={openSpaceAccountDisabled}
                      tooltipText={depositAccountTooltip}
                      onClick={onOpenSpaceAccount}
                    />
                  ) : undefined
                }
              />
              <ApprovedBankingDeposits
                {...depositsProps}
                hideLoadingState={hideListLoadingState}
              />
            </section>

            <BankTransfersSection
              {...transfersProps}
              hideListLoadingState={hideListLoadingState}
              ownerContext={ownerContext}
            />
          </div>
        ) : (
          <section className="flex flex-col gap-4">
            <BankingSubsectionHeader
              title={tPayouts('section.title')}
              description={payoutsDescription}
              action={
                showManageActions ? (
                  <SectionActionButton
                    label={tPayouts('addCta')}
                    disabled={openPayoutAccountDisabled}
                    tooltipText={payoutAccountTooltip}
                    onClick={onOpenPayoutAccount}
                  />
                ) : undefined
              }
            />
            <ApprovedBankingPayouts
              payoutAccounts={payoutAccounts}
              payoutAccountsLoading={payoutAccountsLoading}
              hideLoadingState={hideListLoadingState}
              onCardClick={onPayoutAccountClick}
            />
          </section>
        )}
      </Tabs>
    </section>
  );
};
