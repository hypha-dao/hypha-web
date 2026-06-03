'use client';

import { Phone, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@hypha-platform/ui';

type HumanChatPanelCallJoinInvitationProps = {
  open: boolean;
  deviceCount: number;
  busy: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinAudio?: () => void;
  onJoinVideo: () => void;
  onDismiss: () => void;
};

/** CSH-DISCOVER-1 — viewport-level join invitation (§1.2.2). */
export function HumanChatPanelCallJoinInvitation({
  open,
  deviceCount,
  busy,
  disabled,
  onOpenChange,
  onJoinAudio,
  onJoinVideo,
  onDismiss,
}: HumanChatPanelCallJoinInvitationProps) {
  const t = useTranslations('HumanChatPanel');

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
        onOpenChange(next);
      }}
    >
      <AlertDialogContent viewport="full">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('callJoinInviteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('callJoinInviteDescription', { count: deviceCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel type="button" onClick={onDismiss}>
            {t('callJoinInviteDismiss')}
          </AlertDialogCancel>
          {onJoinAudio ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || busy}
              className="gap-1.5"
              onClick={() => {
                onJoinAudio();
                onDismiss();
              }}
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              {t('callJoinInviteJoinAudio')}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={disabled || busy}
            className="gap-1.5"
            onClick={() => {
              onJoinVideo();
              onDismiss();
            }}
          >
            <Video className="h-4 w-4 shrink-0" aria-hidden />
            {t('callJoinInviteJoinVideo')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
