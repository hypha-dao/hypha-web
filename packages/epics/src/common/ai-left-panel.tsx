'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { LogIn } from 'lucide-react';

import { useAuthentication } from '@hypha-platform/authentication';
import { cn } from '@hypha-platform/ui-utils';

import {
  AiPanelHeader,
  AiPanelMessages,
  AiPanelChatBar,
  MOCK_SUGGESTIONS,
} from './ai-panel';
import { convertFilesToParts } from './ai-panel/convert-files-to-parts';

type AiLeftPanelProps = {
  onClose: () => void;
  className?: string;
};

export function AiLeftPanel({ onClose, className }: AiLeftPanelProps) {
  const CLIENT_CHAT_DEBUG = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';
  const params = useParams<{ id?: string }>();
  const spaceSlug = params?.id ?? null;

  const {
    isAuthenticated,
    login,
    isLoading: isAuthLoading,
    getAccessToken,
  } = useAuthentication();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onError: (error) => {
      if (!CLIENT_CHAT_DEBUG) return;
      console.error('[chat][client][error]', {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
    },
    onFinish: ({ message }) => {
      if (!CLIENT_CHAT_DEBUG) return;
      console.log('[chat][client][finish]', {
        messageId: message.id,
        role: message.role,
        partCount: message.parts?.length ?? 0,
      });
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isStreaming) return;

    if (CLIENT_CHAT_DEBUG) {
      console.log('[chat][client][send-click]', {
        textLength: text.length,
        attachmentCount: attachments.length,
        isStreaming,
        spaceSlug,
      });
    }

    let token = '';
    try {
      token = (await getAccessToken()) ?? '';
    } catch (error) {
      if (CLIENT_CHAT_DEBUG) {
        console.error('[chat][client][token-error]', {
          message: error instanceof Error ? error.message : String(error),
          error,
        });
      }
      return;
    }

    const textPart = { type: 'text' as const, text: text || '(no text)' };
    const fileParts =
      attachments.length > 0 ? await convertFilesToParts(attachments) : [];

    sendMessage(
      {
        role: 'user',
        parts: [textPart, ...fileParts],
      },
      {
        body: {
          ...(spaceSlug && { spaceSlug }),
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );

    if (CLIENT_CHAT_DEBUG) {
      console.log('[chat][client][send-dispatched]', {
        hasAuthToken: Boolean(token),
        bodyHasSpaceSlug: Boolean(spaceSlug),
      });
    }
    setInput('');
    setAttachments([]);
    setShowSuggestions(false);
  };

  const handleSuggestionSelect = (text: string) => {
    setShowSuggestions(false);
    setInput(text);
  };

  const handleResetChat = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  const handleStop = () => {
    stop();
  };

  if (isAuthLoading) {
    return (
      <div
        className={cn(
          'flex h-full min-w-0 flex-col overflow-hidden border-r border-border bg-background-2',
          className,
        )}
      >
        <AiPanelHeader onClose={onClose} onResetChat={handleResetChat} />
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className={cn(
          'flex h-full min-w-0 flex-col overflow-hidden border-r border-border bg-background-2',
          className,
        )}
      >
        <AiPanelHeader onClose={onClose} onResetChat={handleResetChat} />
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            Sign in to use Hypha AI
          </p>
          <button
            type="button"
            onClick={() => login()}
            className="flex items-center gap-2 rounded-xl border border-primary bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden border-r border-border bg-background-2',
        className,
      )}
    >
      <AiPanelHeader onClose={onClose} onResetChat={handleResetChat} />

      <AiPanelMessages
        messages={messages}
        suggestions={MOCK_SUGGESTIONS}
        showSuggestions={showSuggestions}
        onSuggestionSelect={handleSuggestionSelect}
        isStreaming={isStreaming}
      />

      <AiPanelChatBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        isStreaming={isStreaming}
      />
    </div>
  );
}
