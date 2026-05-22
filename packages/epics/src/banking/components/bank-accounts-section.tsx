'use client';

import { FC } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

import { ApprovedBankingDeposits } from './approved-banking-deposits';
import type { ApprovedBankingDepositsProps } from './approved-banking-deposits';

type BankAccountsSectionProps = {
  isAuthenticated: boolean;
  canManage: boolean;
  depositsProps: ApprovedBankingDepositsProps;
  onOpenSpaceAccount?: () => void;
};

export const BankAccountsSection: FC<BankAccountsSectionProps> = ({
  isAuthenticated,
  canManage,
  depositsProps,
  onOpenSpaceAccount,
}) => {
  const t = useTranslations('BankingTab.sections.accounts');
  const tToolbar = useTranslations('BankingTab.toolbar');

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
        {canManage && onOpenSpaceAccount ? (
          <Button
            type="button"
            colorVariant="accent"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={onOpenSpaceAccount}
          >
            <Plus className="h-4 w-4" />
            {tToolbar('openSpaceAccount')}
          </Button>
        ) : null}
      </div>

      {!isAuthenticated ? (
        <p className="text-2 text-muted-foreground">{t('signInHint')}</p>
      ) : (
        <ApprovedBankingDeposits {...depositsProps} />
      )}
    </section>
  );
};
