'use client';

import { useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from '@hypha-platform/ui';

import {
  AiPanelHeader,
  AiPanelMessages,
  AiPanelChatBar,
  MOCK_SUGGESTIONS,
} from './ai-panel';

const DEBUG = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';

export function AiLeftPanel() {
  const { isAuthenticated, isLoading, login, getAccessToken } =
    useAuthentication();
  const params = useParams<{ id?: string }>();
  const spaceSlug = params?.id;
  const { toggleSidebar } = useSidebar();

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
      <>
        <SidebarHeader className="bg-background-2 p-0">
          <AiPanelHeader onResetChat={handleResetChat} />
        </SidebarHeader>
        <SidebarContent className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </SidebarContent>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SidebarHeader className="bg-background-2 p-0">
          <AiPanelHeader onResetChat={handleResetChat} />
        </SidebarHeader>
        <SidebarContent className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <div className="text-center text-sm text-muted-foreground">
            Sign in to use Hypha AI
          </div>
          <button
            onClick={login}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Sign In
          </button>
        </SidebarContent>
      </>
    );
  }

  return (
    <>
      <SidebarHeader className="bg-background-2 p-0">
        <AiPanelHeader onResetChat={handleResetChat} />
      </SidebarHeader>
      <SidebarContent className="bg-background-2 min-h-0">
        <AiPanelMessages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages={messages as any[]}
          suggestions={MOCK_SUGGESTIONS}
          showSuggestions={true}
          onSuggestionSelect={handleSuggestionSelect}
          isStreaming={isStreaming}
        />
      </SidebarContent>
      <SidebarFooter className="bg-background-2 p-0">
        <AiPanelChatBar
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </SidebarFooter>
    </>
  );
}
