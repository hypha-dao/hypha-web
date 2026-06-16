'use client';

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

type CallScreenshareTabAudioPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
};

export function CallScreenshareTabAudioPromptDialog({
  open,
  onOpenChange,
  onContinue,
}: CallScreenshareTabAudioPromptDialogProps) {
  const t = useTranslations('HumanChatPanel');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        viewport="full"
        overlayClassName="bg-black/75 backdrop-blur-sm supports-[backdrop-filter]:bg-black/65"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('callShareTabAudioPromptTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('callShareTabAudioPromptDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('callShareTabAudioPromptCancel')}
          </AlertDialogCancel>
          <Button type="button" colorVariant="accent" onClick={onContinue}>
            {t('callShareTabAudioPromptContinue')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
