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
  Button,
} from '@hypha-platform/ui';
import type { ScreenshareTakeoverIncoming } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

type HumanChatPanelScreenshareTakeoverDialogProps = {
  incoming: ScreenshareTakeoverIncoming | null;
  pending: boolean;
  denied: boolean;
  onApprove: (request: ScreenshareTakeoverIncoming) => void;
  onDeny: (request: ScreenshareTakeoverIncoming) => void;
  onCancelPending: () => void;
  onDismissDenied: () => void;
};

export function HumanChatPanelScreenshareTakeoverDialog({
  incoming,
  pending,
  denied,
  onApprove,
  onDeny,
  onCancelPending,
  onDismissDenied,
}: HumanChatPanelScreenshareTakeoverDialogProps) {
  const t = useTranslations('HumanChatPanel');

  return (
    <>
      <AlertDialog open={Boolean(incoming)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('callScreenshareTakeoverIncomingTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('callScreenshareTakeoverIncomingBody', {
                name: incoming?.requesterLabel ?? t('unknownMember'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (incoming) onDeny(incoming);
              }}
            >
              {t('callScreenshareTakeoverDeny')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (incoming) onApprove(incoming);
              }}
            >
              {t('callScreenshareTakeoverApprove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('callScreenshareTakeoverPendingTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('callScreenshareTakeoverPendingBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelPending}>
              {t('callScreenshareTakeoverCancelRequest')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={denied}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('callScreenshareTakeoverDeniedTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('callScreenshareTakeoverDeniedBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" onClick={onDismissDenied}>
              {t('callScreenshareDismiss')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
