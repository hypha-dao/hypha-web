'use client';

import { useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
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
  const t = useTranslations('AiPanel');

  const [input, setInput] = useState('');

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  );

  const { messages, sendMessage, stop, status, setMessages } = useChat({
    transport,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  const buildMessageOptions = useCallback(async () => {
    const token = await getAccessToken?.();
    const hdrs: Record<string, string> = {};
    if (token) hdrs['Authorization'] = `Bearer ${token}`;
    return {
      body: { ...(spaceSlug && { spaceSlug }) },
      headers: hdrs,
    };
  }, [getAccessToken, spaceSlug]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    try {
      const options = await buildMessageOptions();
      if (DEBUG) console.log('[AiLeftPanel] sendMessage', { text, spaceSlug });
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
    } catch (err) {
      console.error('[AiLeftPanel] sendMessage error:', err);
      setInput(text);
    }
  }, [input, isStreaming, sendMessage, buildMessageOptions, spaceSlug]);

  const handleStop = useCallback(() => {
    void stop();
  }, [stop]);

  const handleResetChat = useCallback(() => setMessages([]), [setMessages]);

  const handleSuggestionSelect = useCallback(
    async (text: string) => {
      try {
        const options = await buildMessageOptions();
        if (DEBUG)
          console.log('[AiLeftPanel] suggestion selected', { text, spaceSlug });
        await sendMessage(
          { role: 'user', parts: [{ type: 'text', text }] },
          options,
        );
      } catch (err) {
        console.error('[AiLeftPanel] suggestion sendMessage error:', err);
      }
    },
    [sendMessage, buildMessageOptions, spaceSlug],
  );

  if (isLoading) {
    return (
      <>
        <SidebarHeader className="bg-background-2 p-0">
          <AiPanelHeader onResetChat={handleResetChat} />
        </SidebarHeader>
        <SidebarContent className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('loading')}</div>
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
            {t('signIn')}
          </div>
          <button
            onClick={login}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('signInButton')}
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
          messages={
            messages as Array<{
              id: string;
              role: 'user' | 'assistant' | 'system';
              parts?: Array<
                | { type: 'text'; text: string }
                | { type: string; [k: string]: unknown }
              >;
            }>
          }
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
