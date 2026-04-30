'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Coins, FileCheck2, Radio, Sparkles, UsersRound } from 'lucide-react';
import { Space, useSpacesBySlugs } from '@hypha-platform/core/client';
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
  Button,
} from '@hypha-platform/ui';

import { AiPanelHeader, AiPanelMessages, AiPanelChatBar } from './ai-panel';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { useAiPanel } from './human-chat-panel-context';
import { convertFilesToParts } from './ai-panel/convert-files-to-parts';
import { Empty } from './empty';

type ChatUIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
};

const DEBUG = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';
const RECENT_SPACE_STORAGE_KEY = 'hypha:recent-space-slugs';
const MAX_RECENT_SPACES = 5;
const MENU_BUTTON_EXPANDED_CLASS =
  'h-10 rounded-lg border border-transparent text-sm font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/80 hover:text-foreground data-[active=true]:border-accent-9/40 data-[active=true]:bg-accent-9/18 data-[active=true]:text-foreground';
const MENU_BUTTON_COLLAPSED_CLASS =
  'group relative h-10 w-full justify-start rounded-lg border border-transparent p-0 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground data-[active=true]:text-foreground group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!rounded-lg group-data-[collapsible=icon]:!p-0';
const ICON_COLUMN_CLASS = 'flex h-10 w-10 shrink-0 items-center justify-center';
const COLLAPSED_ICON_COLUMN_CLASS = `${ICON_COLUMN_CLASS} mx-auto`;
const RECENT_SPACE_AVATAR_CLASS =
  'flex h-6 w-6 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60';

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
  const tSpaces = useTranslations('Spaces');
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
    spaceSlug ? '/api/v1/spaces?parentOnly=false' : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        console.warn('[AiLeftPanel] spaces fetch failed', {
          status: response.status,
          url,
        });
        return [];
      }
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
  const [draftAttachments, setDraftAttachments] = useState<File[]>([]);
  const [recentSpaceSlugs, setRecentSpaceSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RECENT_SPACE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .filter((slug): slug is string => typeof slug === 'string')
          .slice(0, MAX_RECENT_SPACES);
        setRecentSpaceSlugs(cleaned);
      }
    } catch (error) {
      console.warn('[AiLeftPanel] failed to parse recent spaces', error);
    }
  }, []);

  useEffect(() => {
    if (!spaceSlug) return;
    setRecentSpaceSlugs((prev) => {
      const next = [
        spaceSlug,
        ...prev.filter((slug) => slug !== spaceSlug),
      ].slice(0, MAX_RECENT_SPACES);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          RECENT_SPACE_STORAGE_KEY,
          JSON.stringify(next),
        );
      }
      return next;
    });
  }, [spaceSlug]);

  const recentSpaces = useMemo(() => {
    if (recentSpaceSlugs.length === 0 || allSpaces.length === 0) return [];
    const bySlug = new Map(allSpaces.map((space) => [space.slug, space]));
    return recentSpaceSlugs
      .map((slug) => bySlug.get(slug))
      .filter(
        (space): space is Space => Boolean(space) && space.slug !== spaceSlug,
      )
      .slice(0, MAX_RECENT_SPACES);
  }, [allSpaces, recentSpaceSlugs, spaceSlug]);

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
    if ((!input.trim() && draftAttachments.length === 0) || isStreaming) return;
    const text = input;
    const attachments = [...draftAttachments];
    setInput('');
    setDraftAttachments([]);
    try {
      const options = await buildMessageOptions();
      const fileParts =
        attachments.length > 0 ? await convertFilesToParts(attachments) : [];
      const textParts = text.trim() ? [{ type: 'text' as const, text }] : [];
      if (DEBUG)
        console.log('[AiLeftPanel] sendMessage', {
          text,
          attachmentCount: fileParts.length,
          spaceSlug,
        });
      await sendMessage(
        { role: 'user', parts: [...textParts, ...fileParts] },
        options,
      );
    } catch (err) {
      console.error('[AiLeftPanel] sendMessage error:', err);
      setInput(text);
      setDraftAttachments(attachments);
    }
  }, [input, draftAttachments, isStreaming, sendMessage, buildMessageOptions]);

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
                <SidebarMenu className="gap-2">
                  {sectionNavItems.map((item) => (
                    <SidebarMenuItem key={`overlay-${item.key}`}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.active}
                        className={MENU_BUTTON_EXPANDED_CLASS}
                      >
                        <Link
                          href={item.href}
                          aria-label={item.label}
                          aria-current={item.active ? 'page' : undefined}
                          className="flex min-w-0 items-center"
                        >
                          <span className={ICON_COLUMN_CLASS}>
                            <item.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 truncate">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {recentSpaces.length > 0 ? (
              <SidebarGroup className="mt-auto p-2 pb-4">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-2">
                    {recentSpaces.map((space) => {
                      const isRecentActive = space.slug === spaceSlug;
                      const href = `/${lang}/dho/${space.slug}/agreements`;
                      return (
                        <SidebarMenuItem key={`recent-overlay-${space.slug}`}>
                          <SidebarMenuButton
                            asChild
                            isActive={isRecentActive}
                            className={MENU_BUTTON_EXPANDED_CLASS}
                          >
                            <Link
                              href={href}
                              aria-label={space.title}
                              aria-current={isRecentActive ? 'page' : undefined}
                              className="flex min-w-0 items-center"
                            >
                              <span className={ICON_COLUMN_CLASS}>
                                <span
                                  className={`${RECENT_SPACE_AVATAR_CLASS} ${
                                    isRecentActive
                                      ? 'ring-accent-9/45'
                                      : 'group-hover:ring-border/80'
                                  }`}
                                >
                                  {space.logoUrl ? (
                                    <>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={space.logoUrl}
                                        alt={space.title}
                                        className="block h-full w-full rounded-full object-cover object-center"
                                      />
                                    </>
                                  ) : (
                                    <span className="text-xs font-semibold text-muted-foreground">
                                      {space.title.slice(0, 1).toUpperCase()}
                                    </span>
                                  )}
                                </span>
                              </span>
                              <span className="min-w-0 truncate">
                                {space.title}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
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
              <SidebarMenu className="gap-2">
                {sectionNavItems.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={item.active}
                      className={MENU_BUTTON_COLLAPSED_CLASS}
                    >
                      <Link
                        href={item.href}
                        aria-label={item.label}
                        aria-current={item.active ? 'page' : undefined}
                        className={COLLAPSED_ICON_COLUMN_CLASS}
                      >
                        <item.icon
                          className={`h-4 w-4 ${
                            item.active ? 'text-accent-9' : ''
                          }`}
                        />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {recentSpaces.length > 0 ? (
            <SidebarGroup className="mt-auto p-2 pb-4">
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {recentSpaces.map((space) => {
                    const isRecentActive = space.slug === spaceSlug;
                    const href = `/${lang}/dho/${space.slug}/agreements`;
                    return (
                      <SidebarMenuItem key={`recent-collapsed-${space.slug}`}>
                        <SidebarMenuButton
                          asChild
                          tooltip={space.title}
                          isActive={isRecentActive}
                          className={MENU_BUTTON_COLLAPSED_CLASS}
                        >
                          <Link
                            href={href}
                            aria-label={space.title}
                            aria-current={isRecentActive ? 'page' : undefined}
                            className={COLLAPSED_ICON_COLUMN_CLASS}
                          >
                            <span
                              className={`${RECENT_SPACE_AVATAR_CLASS} ${
                                isRecentActive
                                  ? 'ring-accent-9/45'
                                  : 'group-hover:ring-border/80'
                              }`}
                            >
                              {space.logoUrl ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={space.logoUrl}
                                    alt={space.title}
                                    className="block h-full w-full rounded-full object-cover object-center"
                                  />
                                </>
                              ) : (
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {space.title.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>
      </>
    );
  }

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
        <SidebarContent className="flex flex-1 items-center justify-center px-6">
          <Empty>
            <div className="flex flex-col gap-7">
              <p>{tSpaces('accessDeniedNotLoggedIn')}</p>
              <div className="flex gap-4 items-center justify-center">
                <Button variant="outline" onClick={login}>
                  {tSpaces('signIn')}
                </Button>
                <Button onClick={login}>{tSpaces('getStarted')}</Button>
              </div>
            </div>
          </Empty>
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
          draftAttachments={draftAttachments}
          onDraftAttachmentsChange={setDraftAttachments}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </SidebarFooter>
    </>
  );
}
