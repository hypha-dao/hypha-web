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

type HumanChatPanelCallSwitchConfirmDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** #2456 D2 scenario 0: confirms leaving an in-progress call to join a different room's call. */
export function HumanChatPanelCallSwitchConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: HumanChatPanelCallSwitchConfirmDialogProps) {
  const t = useTranslations('GlobalCallDock');

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('callSwitchConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('callSwitchConfirmBody')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('callSwitchConfirmCancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('callSwitchConfirmLeaveAndJoin')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
