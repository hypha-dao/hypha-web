'use client';

import { FC } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';

import type { BankVirtualAccountCurrency } from '../hooks/types';

export type AvailableCorridor = {
  currency: BankVirtualAccountCurrency;
  paymentRail: string;
  labelKey: string;
};

type AddVirtualAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corridors: AvailableCorridor[];
  canManage: boolean;
  isProvisioning: boolean;
  provisioningCurrency: BankVirtualAccountCurrency | null;
  onSelect: (currency: BankVirtualAccountCurrency) => void;
};

export const AddVirtualAccountDialog: FC<AddVirtualAccountDialogProps> = ({
  open,
  onOpenChange,
  corridors,
  canManage,
  isProvisioning,
  provisioningCurrency,
  onSelect,
}) => {
  const t = useTranslations('BankingTab');
  const tCorridors = useTranslations('BankingTab.corridors');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tCorridors('addDialogTitle')}</DialogTitle>
          <DialogDescription>
            {tCorridors('addDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {corridors.map((corridor) => {
            const isBusy =
              isProvisioning && provisioningCurrency === corridor.currency;
            return (
              <li key={corridor.currency}>
                <button
                  type="button"
                  disabled={!canManage || isProvisioning}
                  onClick={() => onSelect(corridor.currency)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background-2 px-4 py-3 text-left transition-colors hover:border-accent-7 hover:bg-accent-2/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-3 font-medium text-foreground">
                    {t(
                      `endorsements.${corridor.labelKey}` as 'endorsements.sepa',
                    )}
                  </span>
                  {isBusy ? (
                    <span className="inline-flex items-center gap-1.5 text-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tCorridors('provisioning')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-2 text-accent-11">
                      <Plus className="h-4 w-4" />
                      {tCorridors('addDialogSelect')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

function getEndorsementLabelKey(paymentRail: string): string {
  return paymentRail === 'ach' ? 'base' : paymentRail;
}

export function toAvailableCorridors(
  corridors: ReadonlyArray<{
    currency: BankVirtualAccountCurrency;
    paymentRail: string;
  }>,
): AvailableCorridor[] {
  return corridors.map((c) => ({
    ...c,
    labelKey: getEndorsementLabelKey(c.paymentRail),
  }));
}
