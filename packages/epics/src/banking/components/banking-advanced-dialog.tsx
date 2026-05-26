'use client';

import { FC } from 'react';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import type { BankCustomerPublicStatus } from '../hooks/types';
import {
  BANKING_DIALOG_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
import { BankingProviderStatusPanel } from './banking-provider-status-panel';

type BankingAdvancedDialogProps = {
  spaceSlug: string;
  status: BankCustomerPublicStatus | null | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isSyncingBanking?: boolean;
  canManage: boolean;
  blockerMessage: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
  onSyncBanking?: () => void;
};

export const BankingAdvancedDialog: FC<BankingAdvancedDialogProps> = ({
  spaceSlug,
  status,
  isLoading,
  isRefreshing,
  isSyncingBanking = false,
  canManage,
  blockerMessage,
  open,
  onOpenChange,
  onRefreshStatus,
  onSyncBanking,
}) => {
  const tAdvanced = useTranslations('BankingTab.advanced');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={tAdvanced('gearLabel')}
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(BANKING_DIALOG_CONTENT_CLASS, 'max-w-lg')}>
        <DialogHeader className={BANKING_DIALOG_HEADER_CLASS}>
          <DialogTitle>{tAdvanced('dialogTitle')}</DialogTitle>
          <DialogDescription>
            {tAdvanced('dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <BankingDialogBody>
          <BankingProviderStatusPanel
            spaceSlug={spaceSlug}
            status={status}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            isSyncingBanking={isSyncingBanking}
            canManage={canManage}
            blockerMessage={blockerMessage}
            onRefreshStatus={onRefreshStatus}
            onSyncBanking={onSyncBanking}
            onOpenGear={() => onOpenChange?.(true)}
          />
        </BankingDialogBody>
      </DialogContent>
    </Dialog>
  );
};
