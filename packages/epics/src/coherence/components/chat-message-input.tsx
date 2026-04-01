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

export const ChatMessageInput = ({
  roomId,
  coherenceSlug,
  closeUrl,
}: {
  roomId: string;
  coherenceSlug: string;
  closeUrl: string;
}) => {
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
          title="Archive Conversation"
          description="Do you really want to archive this conversation?"
          customAcceptButtonText="Yes, archive"
          customRejectButtonText="No, leave"
          onAcceptClicked={handleArchive}
        >
          <Button
            variant="outline"
            colorVariant="neutral"
            className="bg-transparent text-neutral-11"
          >
            Archive Conversation
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
          Propose Agreement
        </Button>
      </div>
      <div className="w-full space-y-2">
        <div className="flex flex-grow text-1 text-neutral-11">
          <Input
            className="w-full"
            placeholder="Say something..."
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
