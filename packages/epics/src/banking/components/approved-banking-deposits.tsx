'use client';

import { FC, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';

import {
  BANK_VIRTUAL_ACCOUNT_CORRIDORS,
  type BankVirtualAccountCurrency,
  type BankVirtualAccountPublic,
} from '../hooks/types';
import {
  AddVirtualAccountDialog,
  toAvailableCorridors,
} from './add-virtual-account-dialog';
import { DepositInstructionsCard } from './deposit-instructions-card';

type ApprovedBankingDepositsProps = {
  virtualAccounts: BankVirtualAccountPublic[];
  virtualAccountsLoading: boolean;
  canManage: boolean;
  isProvisioning: boolean;
  provisioningCurrency: BankVirtualAccountCurrency | null;
  provisionError: string | null;
  onProvision: (currency: BankVirtualAccountCurrency) => void;
};

export const ApprovedBankingDeposits: FC<ApprovedBankingDepositsProps> = ({
  virtualAccounts,
  virtualAccountsLoading,
  canManage,
  isProvisioning,
  provisioningCurrency,
  provisionError,
  onProvision,
}) => {
  const t = useTranslations('BankingTab');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const provisionedKeys = useMemo(
    () => new Set(virtualAccounts.map((a) => `${a.currency}:${a.paymentRail}`)),
    [virtualAccounts],
  );

  const availableCorridors = useMemo(
    () =>
      toAvailableCorridors(
        BANK_VIRTUAL_ACCOUNT_CORRIDORS.filter(
          (c) => !provisionedKeys.has(`${c.currency}:${c.paymentRail}`),
        ),
      ),
    [provisionedKeys],
  );

  const canAddAccount =
    !virtualAccountsLoading &&
    canManage &&
    !isProvisioning &&
    availableCorridors.length > 0;

  const handleSelectCorridor = (currency: BankVirtualAccountCurrency) => {
    onProvision(currency);
    setAddDialogOpen(false);
  };

  if (virtualAccountsLoading) {
    return (
      <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background-2/50 py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-2 text-muted-foreground">{t('corridors.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h4 className="text-3 font-semibold tracking-tight text-foreground">
          {t('corridors.activeTitle')}
        </h4>

        {virtualAccounts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {virtualAccounts.map((account) => (
              <DepositInstructionsCard
                key={`${account.currency}:${account.paymentRail}`}
                account={account}
              />
            ))}
            {canAddAccount ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {t('corridors.addAccountCta')}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-background-2/50 px-4 py-10 text-center">
            <p className="text-2 text-muted-foreground">
              {t('corridors.emptyAccounts')}
            </p>
            {canAddAccount ? (
              <Button
                type="button"
                colorVariant="accent"
                size="sm"
                className="mt-4"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {t('corridors.addAccountCta')}
              </Button>
            ) : null}
          </div>
        )}

        {!canManage && availableCorridors.length > 0 ? (
          <p className="text-2 text-muted-foreground">
            {t('corridors.addDisabledNotManager')}
          </p>
        ) : null}

        {availableCorridors.length === 0 && virtualAccounts.length > 0 ? (
          <p className="text-2 text-muted-foreground">
            {t('corridors.allActive')}
          </p>
        ) : null}
      </section>

      {provisionError ? (
        <p className="rounded-md border border-error-6 bg-error-2 px-3 py-2 text-2 text-error-11">
          {provisionError}
        </p>
      ) : null}

      <AddVirtualAccountDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        corridors={availableCorridors}
        canManage={canManage}
        isProvisioning={isProvisioning}
        provisioningCurrency={provisioningCurrency}
        onSelect={handleSelectCorridor}
      />
    </div>
  );
};
