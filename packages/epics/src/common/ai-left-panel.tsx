'use client';

import { useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from '@hypha-platform/ui';

import { AiPanelHeader, AiPanelMessages, AiPanelChatBar } from './ai-panel';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { useSpaceNavIntent } from './space-nav-intent-context';

type ChatUIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
};

const DEBUG = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';

export function AiLeftPanel() {
  const spaceNav = useSpaceNavIntent();
  const { isAuthenticated, isLoading, login, getAccessToken } =
    useAuthentication();
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const spaceSlugFromPath = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  /** Prefer pathname: AiLeftPanel mounts in root layout where `id` is often missing for `/dho/[id]/...` routes. */
  const spaceSlug = spaceSlugFromPath ?? params?.id;
  const t = useTranslations('AiPanel');

  const [input, setInput] = useState('');

  const suggestions = useMemo(
    () => [
      t('suggestions.aboutSpace'),
      t('suggestions.memberCount'),
      t('suggestions.agreements'),
      t('suggestions.structure'),
    ],
    [t],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: async (): Promise<Record<string, string>> => {
          const token = await getAccessToken?.();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: { ...(spaceSlug && { spaceSlug }) },
      }),
    [getAccessToken, spaceSlug],
  );

  const { messages, sendMessage, stop, status, setMessages, error } = useChat({
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
  }, [input, isStreaming, sendMessage, buildMessageOptions]);

  const handleStop = useCallback(() => {
    void stop();
  }, [stop]);

  const handleResetChat = useCallback(() => setMessages([]), [setMessages]);

  const handleSuggestionSelect = useCallback(
    async (text: string) => {
      if (spaceNav?.isManualCooldownActive()) {
        return;
      }
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
    [sendMessage, buildMessageOptions, spaceNav, spaceSlug],
  );

  const suggestQuiet = spaceNav?.isManualCooldownActive() ?? false;

  if (isLoading) {
    return (
      <>
        <SidebarHeader className="bg-background-2 shrink-0 p-0">
          <AiPanelHeader onResetChat={handleResetChat} />
        </SidebarHeader>
        <SidebarContent className="flex flex-1 shrink-0 items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('loading')}</div>
        </SidebarContent>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SidebarHeader className="bg-background-2 shrink-0 p-0">
          <AiPanelHeader onResetChat={handleResetChat} />
        </SidebarHeader>
        <SidebarContent className="flex flex-1 shrink-0 flex-col items-center justify-center gap-4 p-6">
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
      <SidebarHeader className="bg-background-2 shrink-0 p-0">
        <AiPanelHeader onResetChat={handleResetChat} />
      </SidebarHeader>
      <SidebarContent className="bg-background-2 min-h-0 flex-1">
        {error && (
          <div
            role="alert"
            className="mx-3 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {t('streamError')}
          </div>
        )}
        <AiPanelMessages
          messages={messages as ChatUIMessage[]}
          suggestions={suggestions}
          showSuggestions={!suggestQuiet}
          onSuggestionSelect={handleSuggestionSelect}
          isStreaming={isStreaming}
        />
      </SidebarContent>
      <SidebarFooter className="bg-background-2 shrink-0 p-0">
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
