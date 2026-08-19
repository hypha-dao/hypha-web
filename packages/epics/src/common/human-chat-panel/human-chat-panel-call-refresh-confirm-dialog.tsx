'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type HumanChatPanelCallRefreshConfirmDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** #2456 D2e: confirms moving a call from another device to this one ("Refresh call"). */
export function HumanChatPanelCallRefreshConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: HumanChatPanelCallRefreshConfirmDialogProps) {
  const t = useTranslations('GlobalCallDock');

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('callRefreshConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('callRefreshConfirmBody')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('callRefreshConfirmCancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('callRefreshConfirmMoveHere')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
