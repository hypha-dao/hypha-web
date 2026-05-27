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
  canManage: boolean;
  blockerMessage: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
};

export const BankingAdvancedDialog: FC<BankingAdvancedDialogProps> = ({
  spaceSlug,
  status,
  isLoading,
  isRefreshing,
  canManage,
  blockerMessage,
  open,
  onOpenChange,
  onRefreshStatus,
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
      <DialogContent
        className={cn(BANKING_DIALOG_CONTENT_CLASS, 'max-w-lg')}
      >
        <DialogHeader className={cn(BANKING_DIALOG_HEADER_CLASS, 'pr-10')}>
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
            canManage={canManage}
            blockerMessage={blockerMessage}
            onRefreshStatus={onRefreshStatus}
            onOpenGear={() => onOpenChange?.(true)}
          />
        </BankingDialogBody>
      </DialogContent>
    </Dialog>
  );
};
