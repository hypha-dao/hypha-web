'use client';

import React from 'react';
import {
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMatrix,
} from '@hypha-platform/core/client';
import { Button, ConfirmDialog, Input } from '@hypha-platform/ui';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export const ChatMessageInput = ({
  roomId,
  coherenceSlug,
  closeUrl,
}: {
  roomId: string;
  coherenceSlug: string;
  closeUrl: string;
}) => {
  const t = useTranslations('CoherenceTab');
  const { client, sendMessage: sendMatrixMessage } = useMatrix();
  const [input, setInput] = React.useState('');
  const { jwt: authToken } = useJwt();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const router = useRouter();

  const sendMessage = React.useCallback(async () => {
    try {
      await sendMatrixMessage({ roomId, message: input.trim() });
      setInput('');
    } catch (error) {
      console.warn(error);
    }
  }, [client, input, roomId, sendMatrixMessage]);

  const handleArchive = React.useCallback(async () => {
    try {
      await updateCoherenceBySlug({ slug: coherenceSlug, archived: true });
      router.push(closeUrl);
    } catch (error) {
      console.warn('Could not archive conversation:', error);
    }
  }, [coherenceSlug, router, closeUrl]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-grow text-1 text-neutral-11 gap-3">
        <ConfirmDialog
          title={t('archiveConversation')}
          description={t('archiveConfirm')}
          customAcceptButtonText={t('yesArchive')}
          customRejectButtonText={t('noLeave')}
          onAcceptClicked={handleArchive}
        >
          <Button
            variant="outline"
            colorVariant="neutral"
            className="bg-transparent text-neutral-11"
          >
            {t('archiveConversation')}
          </Button>
        </ConfirmDialog>
        <Button
          variant="outline"
          colorVariant="accent"
          className="grow"
          onClick={(e) => {
            console.log('Propose Agreement clicked');
            //TODO
          }}
        >
          {t('proposeAgreement')}
        </Button>
      </div>
      <div className="w-full space-y-2">
        <div className="flex flex-grow text-1 text-neutral-11">
          <Input
            className="w-full"
            placeholder={t('saySomething')}
            value={input}
            rightIcon={
              <Button
                variant="ghost"
                colorVariant="neutral"
                className="w-6 h-6 p-0 pointer-events-auto!"
                onClick={(e) => {
                  sendMessage();
                }}
              >
                <PaperPlaneIcon />
              </Button>
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                sendMessage();
              }
            }}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
