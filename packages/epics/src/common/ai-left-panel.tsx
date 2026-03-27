'use client';

import { useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams } from 'next/navigation';

import {
  AiPanelHeader,
  AiPanelMessages,
  AiPanelChatBar,
  MOCK_SUGGESTIONS,
} from './ai-panel';

const DEBUG = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';

type AiLeftPanelProps = {
  onClose: () => void;
};

export function AiLeftPanel({ onClose }: AiLeftPanelProps) {
  const { isAuthenticated, isLoading, login, getAccessToken } =
    useAuthentication();
  const params = useParams<{ id?: string }>();
  const spaceSlug = params?.id;

  const [input, setInput] = useState('');

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  );

  const { messages, sendMessage, stop, status, setMessages } = useChat({
    transport,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    const token = await getAccessToken?.();
    if (DEBUG) console.log('[AiLeftPanel] sendMessage', { text, spaceSlug });
    await sendMessage(
      { role: 'user', parts: [{ type: 'text', text }] },
      {
        body: { ...(spaceSlug && { spaceSlug }) },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
  }, [input, isStreaming, sendMessage, getAccessToken, spaceSlug]);

  const handleStop = useCallback(() => {
    void stop();
  }, [stop]);

  const handleResetChat = useCallback(() => setMessages([]), [setMessages]);

  const handleSuggestionSelect = useCallback(
    async (text: string) => {
      const token = await getAccessToken?.();
      if (DEBUG)
        console.log('[AiLeftPanel] suggestion selected', { text, spaceSlug });
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        {
          body: { ...(spaceSlug && { spaceSlug }) },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
    },
    [sendMessage, getAccessToken, spaceSlug],
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col bg-background-2">
        <AiPanelHeader onClose={onClose} onResetChat={handleResetChat} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-full w-full flex-col bg-background-2">
        <AiPanelHeader onClose={onClose} onResetChat={handleResetChat} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <div className="text-center text-sm text-muted-foreground">
            Sign in to use Hypha AI
          </div>
          <button
            onClick={login}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-r border-border bg-background-2">
      <AiPanelHeader onClose={onClose} onResetChat={handleResetChat} />
      <AiPanelMessages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages={messages as any[]}
        suggestions={MOCK_SUGGESTIONS}
        showSuggestions={true}
        onSuggestionSelect={handleSuggestionSelect}
        isStreaming={isStreaming}
      />
      <AiPanelChatBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
      />
    </div>
  );
}
