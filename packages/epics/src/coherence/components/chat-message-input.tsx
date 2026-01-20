'use client';

import React from 'react';
import { useMatrix } from '@hypha-platform/core/client';
import { Button, Input } from '@hypha-platform/ui';
import { PaperPlaneIcon } from '@radix-ui/react-icons';

export const ChatMessageInput = ({ roomId }: { roomId: string }) => {
  const { client, sendMessage: sendMatrixMessage } = useMatrix();
  const [input, setInput] = React.useState('');

  const sendMessage = React.useCallback(async () => {
    try {
      await sendMatrixMessage({ roomId, message: input.trim() });
      setInput('');
    } catch (error) {
      console.warn(error);
    }
  }, [client, input, roomId, sendMatrixMessage]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-grow text-1 text-neutral-11 gap-3">
        <Button
          variant="outline"
          colorVariant="neutral"
          className="bg-transparent text-neutral-11"
          onClick={(e) => {
            console.log('Archive Conversation clicked');
            //TODO
          }}
        >
          Archive Conversation
        </Button>
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
