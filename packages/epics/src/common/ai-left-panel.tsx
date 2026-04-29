'use client';

import { useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Coins, FileCheck2, Radio, Sparkles, UsersRound } from 'lucide-react';
import {
  Space,
  useSpacesBySlugs,
} from '@hypha-platform/core/client';
import useSWR from 'swr';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@hypha-platform/ui';

import { AiPanelHeader, AiPanelMessages, AiPanelChatBar } from './ai-panel';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { useAiPanel } from './human-chat-panel-context';

type ChatUIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
};

const DEBUG = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';

export function AiLeftPanel() {
  const { isAuthenticated, isLoading, login, getAccessToken } =
    useAuthentication();
  const params = useParams<{ id?: string; lang?: string }>();
  const pathname = usePathname();
  const spaceSlugFromPath = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  /** Prefer pathname: AiLeftPanel mounts in root layout where `id` is often missing for `/dho/[id]/...` routes. */
  const spaceSlug = spaceSlugFromPath ?? params?.id;
  const t = useTranslations('AiPanel');
  const tCommon = useTranslations('Common');
  const tCoherence = useTranslations('CoherenceTab');
  const lang = typeof params?.lang === 'string' ? params.lang : 'en';
  const {
    open: isAiOpen,
    overlayVisible,
    showAiOverlay,
    hideAiOverlay,
  } = useAiPanel();
  const { spaces: activeSpaces } = useSpacesBySlugs(
    spaceSlug ? [spaceSlug] : [],
  );
  const { data: allSpaces = [] } = useSWR<Space[]>(
    '/api/v1/spaces?parentOnly=false',
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];
      return (await response.json()) as Space[];
    },
  );
  const activeSpaceFromList = useMemo(
    () => allSpaces.find((space) => space.slug === spaceSlug),
    [allSpaces, spaceSlug],
  );
  const activeSpaceIcon =
    activeSpaceFromList?.logoUrl?.trim() ||
    activeSpaces[0]?.logoUrl?.trim() ||
    null;
  const activeSpaceTitle =
    activeSpaceFromList?.title?.trim() ||
    activeSpaces[0]?.title?.trim() ||
    t('title');
  const isSectionActive = useCallback(
    (section: 'coherence' | 'agreements' | 'members' | 'treasury') => {
      if (!spaceSlug) return false;
      const base = `/${lang}/dho/${spaceSlug}/${section}`;
      return pathname === base || pathname.startsWith(`${base}/`);
    },
    [lang, pathname, spaceSlug],
  );

  const sectionNavItems = useMemo(() => {
    if (!spaceSlug) return [];
    return [
      {
        key: 'signals',
        label: tCoherence('signals'),
        icon: Radio,
        href: `/${lang}/dho/${spaceSlug}/coherence`,
        active: isSectionActive('coherence'),
      },
      {
        key: 'agreements',
        label: tCommon('Agreements'),
        icon: FileCheck2,
        href: `/${lang}/dho/${spaceSlug}/agreements`,
        active: isSectionActive('agreements'),
      },
      {
        key: 'members',
        label: tCommon('Members'),
        icon: UsersRound,
        href: `/${lang}/dho/${spaceSlug}/members`,
        active: isSectionActive('members'),
      },
      {
        key: 'treasury',
        label: tCommon('Treasury'),
        icon: Coins,
        href: `/${lang}/dho/${spaceSlug}/treasury`,
        active: isSectionActive('treasury'),
      },
    ];
  }, [isSectionActive, lang, spaceSlug, tCommon, tCoherence]);

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

  const { messages, sendMessage, stop, status, error } = useChat({
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
    [sendMessage, buildMessageOptions],
  );
  const handleHeaderIconMouseEnter = useCallback(() => {
    if (!overlayVisible) {
      showAiOverlay();
    }
  }, [overlayVisible, showAiOverlay]);

  const handleExpandedRegionMouseEnter = useCallback(() => {
    if (overlayVisible) {
      showAiOverlay();
    }
  }, [overlayVisible, showAiOverlay]);

  if (isLoading) {
    return (
      <>
        <SidebarHeader className="bg-background-2 p-0">
          <AiPanelHeader />
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
          <AiPanelHeader />
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

  if (!isAiOpen) {
    if (overlayVisible) {
      return (
        <>
          <SidebarHeader
            className="bg-background-2 p-0"
            onMouseEnter={handleExpandedRegionMouseEnter}
            onMouseLeave={hideAiOverlay}
          >
            <AiPanelHeader />
          </SidebarHeader>
          <SidebarContent
            className="bg-background-2"
            onMouseEnter={handleExpandedRegionMouseEnter}
            onMouseLeave={hideAiOverlay}
          >
            <SidebarGroup className="p-2 pt-4">
              <SidebarGroupContent>
                <SidebarMenu>
                  {sectionNavItems.map((item) => (
                    <SidebarMenuItem key={`overlay-${item.key}`}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.active}
                        className="data-[active=true]:bg-accent-9/20 data-[active=true]:text-foreground"
                      >
                        <Link
                          href={item.href}
                          aria-label={item.label}
                          aria-current={item.active ? 'page' : undefined}
                        >
                          <item.icon className="h-5 w-5" strokeWidth={2.1} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </>
      );
    }

    return (
      <>
        <SidebarHeader className="min-h-[var(--menu-top-height,65px)] items-center justify-center border-b border-border bg-background-2 p-2">
          <div
            className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/70"
            onMouseEnter={handleHeaderIconMouseEnter}
          >
            {activeSpaceIcon ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeSpaceIcon}
                  alt={activeSpaceTitle}
                  className="h-full w-full object-cover"
                />
              </>
            ) : (
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </SidebarHeader>
        <SidebarContent
          className="relative overflow-visible bg-background-2"
          onMouseEnter={showAiOverlay}
          onMouseLeave={hideAiOverlay}
        >
          <SidebarGroup className="p-2 pt-4">
            <SidebarGroupContent>
              <SidebarMenu className="items-center gap-2">
                {sectionNavItems.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={item.active}
                      className="h-10 w-10 justify-center rounded-xl p-0 data-[active=true]:bg-accent-9/20 data-[active=true]:text-foreground"
                    >
                      <Link
                        href={item.href}
                        aria-label={item.label}
                        aria-current={item.active ? 'page' : undefined}
                      >
                        <item.icon className="h-5 w-5" strokeWidth={2.1} />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </>
    );
  }

  return (
    <>
      <SidebarHeader className="bg-background-2 p-0">
        <AiPanelHeader />
      </SidebarHeader>
      <SidebarContent className="bg-background-2 min-h-0">
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
