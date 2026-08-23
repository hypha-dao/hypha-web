'use client';

import { Loader2 } from 'lucide-react';
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
  /** #2456: true from the confirm click until the leave-then-join actually fires. The dialog
   * stays open and busy through this window instead of vanishing the instant you click with
   * nothing visible happening until the new call lands (or, previously, sometimes never did). */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** #2456 D2 scenario 0: confirms leaving an in-progress call to join a different room's call. */
export function HumanChatPanelCallSwitchConfirmDialog({
  open,
  busy = false,
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
          <AlertDialogCancel onClick={onCancel} disabled={busy}>
            {t('callSwitchConfirmCancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {t('callSwitchConfirmLeaveAndJoin')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
