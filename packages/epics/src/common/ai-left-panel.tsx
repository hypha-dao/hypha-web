'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  HardDrive,
  HandCoins,
  Coins,
  FileCheck2,
  Orbit,
  Menu,
  PanelLeftClose,
  Radio,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
} from 'lucide-react';
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
import { resolveSpaceDisplayLogoUrl } from '../spaces/utils/resolve-space-display-logo-url';

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
const MENU_BUTTON_CLASS =
  'h-10 w-full rounded-lg border border-transparent p-0 text-sm font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/80 hover:text-foreground data-[active=true]:border-accent-9/40 data-[active=true]:bg-accent-9/18 data-[active=true]:text-foreground group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!rounded-lg group-data-[collapsible=icon]:!p-0';
const ICON_COLUMN_CLASS = 'flex h-10 w-10 shrink-0 items-center justify-center';
const MENU_ROW_LINK_BASE_CLASS = 'flex w-full min-w-0 items-center';
const MENU_ROW_LINK_EXPANDED_CLASS = 'pl-1.5';
const MENU_ROW_LINK_COLLAPSED_CLASS = 'justify-center';
const MENU_TRIGGER_CANVAS_CLASS =
  'relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-muted p-0 ring-1 ring-border/70';
const MENU_CLOSE_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';
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
    closeAiPanel,
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
  const isSectionActive = useCallback(
    (
      section:
        | 'coherence'
        | 'ecosystem-navigation'
        | 'agreements'
        | 'members'
        | 'treasury'
        | 'rewards'
        | 'memory',
    ) => {
      if (!spaceSlug) return false;
      if (
        section === 'agreements' &&
        pathname.includes(`/dho/${spaceSlug}/`) &&
        pathname.includes('/space-configuration')
      ) {
        return false;
      }
      const base = `/${lang}/dho/${spaceSlug}/${section}`;
      return pathname === base || pathname.startsWith(`${base}/`);
    },
    [lang, pathname, spaceSlug],
  );

  const sectionNavItems = useMemo(() => {
    if (!spaceSlug) return [];
    return [
      {
        key: 'ecosystem-navigation',
        label: 'Ecosystem',
        icon: Orbit,
        href: `/${lang}/dho/${spaceSlug}/ecosystem-navigation`,
        active: isSectionActive('ecosystem-navigation'),
      },
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
      {
        key: 'rewards',
        label: 'Rewards',
        icon: HandCoins,
        href: `/${lang}/dho/${spaceSlug}/rewards`,
        active: isSectionActive('rewards'),
      },
      {
        key: 'memory',
        label: 'Memory',
        icon: HardDrive,
        href: `/${lang}/dho/${spaceSlug}/memory`,
        active: isSectionActive('memory'),
      },
    ];
  }, [isSectionActive, lang, spaceSlug, tCommon, tCoherence]);
  const isSpaceSettingsActive = useMemo(
    () =>
      Boolean(spaceSlug) &&
      pathname.includes(`/dho/${spaceSlug}/`) &&
      pathname.includes('/space-configuration'),
    [pathname, spaceSlug],
  );
  const spaceSettingsItem = useMemo(() => {
    if (!spaceSlug) return null;
    return {
      key: 'space-settings',
      label: 'Space Settings',
      icon: SlidersHorizontal,
      href: `/${lang}/dho/${spaceSlug}/agreements/space-configuration`,
      active: isSpaceSettingsActive,
    };
  }, [isSpaceSettingsActive, lang, spaceSlug]);

  const [input, setInput] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<File[]>([]);
  const [recentSpaceSlugs, setRecentSpaceSlugs] = useState<string[]>([]);
  const [isHoverOpenLocked, setIsHoverOpenLocked] = useState(false);

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
      .filter((space): space is Space => space != null)
      .filter((space) => space.slug !== spaceSlug)
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

  const renderSectionNavItem = useCallback(
    (
      item: (typeof sectionNavItems)[number],
      mode: 'expanded' | 'collapsed',
      keyPrefix: string,
    ) => {
      const showLabel = mode === 'expanded';
      const iconClassName = `h-4 w-4${item.active ? ' text-accent-9' : ''}`;
      const labelClassName = `min-w-0 truncate${
        showLabel && item.active ? ' text-accent-9' : ''
      }`;

      return (
        <SidebarMenuItem key={`${keyPrefix}-${item.key}`}>
          <SidebarMenuButton
            asChild
            tooltip={!showLabel ? item.label : undefined}
            isActive={item.active}
            className={MENU_BUTTON_CLASS}
          >
            <Link
              href={item.href}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
              className={`${MENU_ROW_LINK_BASE_CLASS} ${
                showLabel
                  ? MENU_ROW_LINK_EXPANDED_CLASS
                  : MENU_ROW_LINK_COLLAPSED_CLASS
              }`}
            >
              <span className={ICON_COLUMN_CLASS}>
                <item.icon className={iconClassName} />
              </span>
              {showLabel ? (
                <span className={labelClassName}>{item.label}</span>
              ) : null}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    },
    [],
  );

  const renderRecentSpaceItem = useCallback(
    (space: Space, mode: 'expanded' | 'collapsed', keyPrefix: string) => {
      const showLabel = mode === 'expanded';
      const isRecentActive = space.slug === spaceSlug;
      const href = `/${lang}/dho/${space.slug}/agreements`;
      const recentSpaceIcon = resolveSpaceDisplayLogoUrl(space);

      return (
        <SidebarMenuItem key={`${keyPrefix}-${space.slug}`}>
          <SidebarMenuButton
            asChild
            tooltip={!showLabel ? space.title : undefined}
            isActive={isRecentActive}
            className={MENU_BUTTON_CLASS}
          >
            <Link
              href={href}
              aria-label={space.title}
              aria-current={isRecentActive ? 'page' : undefined}
              className={`${MENU_ROW_LINK_BASE_CLASS} ${
                showLabel
                  ? MENU_ROW_LINK_EXPANDED_CLASS
                  : MENU_ROW_LINK_COLLAPSED_CLASS
              }`}
            >
              <span className={ICON_COLUMN_CLASS}>
                <span
                  className={`${RECENT_SPACE_AVATAR_CLASS} ${
                    isRecentActive
                      ? 'ring-accent-9/45'
                      : 'group-hover:ring-border/80'
                  }`}
                >
                  {recentSpaceIcon ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={recentSpaceIcon}
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
              {showLabel ? (
                <span className="min-w-0 truncate">{space.title}</span>
              ) : null}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    },
    [lang, spaceSlug],
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
    if (isHoverOpenLocked) return;
    if (!overlayVisible) {
      showAiOverlay();
    }
  }, [isHoverOpenLocked, overlayVisible, showAiOverlay]);

  const handleExpandedRegionMouseEnter = useCallback(() => {
    if (isHoverOpenLocked) return;
    if (overlayVisible) {
      showAiOverlay();
    }
  }, [isHoverOpenLocked, overlayVisible, showAiOverlay]);

  const handleCollapsedRegionMouseEnter = useCallback(() => {
    if (isHoverOpenLocked) return;
    showAiOverlay();
  }, [isHoverOpenLocked, showAiOverlay]);

  const handleOverlayMouseLeave = useCallback(() => {
    setIsHoverOpenLocked(false);
    hideAiOverlay();
  }, [hideAiOverlay]);

  const handleOverlayClose = useCallback(() => {
    setIsHoverOpenLocked(true);
    closeAiPanel();
  }, [closeAiPanel]);

  const handleTriggerClick = useCallback(() => {
    if (isAiOpen || overlayVisible) {
      handleOverlayClose();
      return;
    }
    showAiOverlay();
  }, [handleOverlayClose, isAiOpen, overlayVisible, showAiOverlay]);
  const shouldCloseFromTrigger = isAiOpen || overlayVisible;
  const handleTriggerMouseLeave = useCallback(() => {
    if (isHoverOpenLocked) {
      setIsHoverOpenLocked(false);
    }
  }, [isHoverOpenLocked]);
  const canHoverOpenFromTrigger = !shouldCloseFromTrigger && !isHoverOpenLocked;

  const triggerButton = (
    <button
      type="button"
      onClick={handleTriggerClick}
      onMouseEnter={
        canHoverOpenFromTrigger ? handleHeaderIconMouseEnter : undefined
      }
      onMouseLeave={
        !shouldCloseFromTrigger ? handleTriggerMouseLeave : undefined
      }
      className={MENU_TRIGGER_CANVAS_CLASS}
      aria-label={shouldCloseFromTrigger ? t('closePanel') : t('openPanel')}
      title={shouldCloseFromTrigger ? t('hidePanel') : t('openPanel')}
    >
      <Menu className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
    </button>
  );
  const closeButton = shouldCloseFromTrigger ? (
    <button
      type="button"
      onClick={handleOverlayClose}
      className={MENU_CLOSE_BUTTON_CLASS}
      title={t('hidePanel')}
      aria-label={t('closePanel')}
    >
      <PanelLeftClose className="h-4 w-4" />
    </button>
  ) : undefined;

  if (!isAiOpen) {
    if (overlayVisible) {
      return (
        <>
          <SidebarHeader
            className="bg-background-2 p-0"
            onMouseEnter={handleExpandedRegionMouseEnter}
            onMouseLeave={handleOverlayMouseLeave}
          >
            <AiPanelHeader
              showCloseButton={false}
              leftSlot={triggerButton}
              rightSlot={closeButton}
            />
          </SidebarHeader>
          <SidebarContent
            className="bg-background-2"
            onMouseEnter={handleExpandedRegionMouseEnter}
            onMouseLeave={handleOverlayMouseLeave}
          >
            <SidebarGroup className="p-2 pt-4">
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {sectionNavItems.map((item) =>
                    renderSectionNavItem(item, 'expanded', 'overlay'),
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {spaceSettingsItem ? (
              <SidebarGroup className="mt-auto p-2 pb-0">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-2">
                    {renderSectionNavItem(
                      spaceSettingsItem,
                      'expanded',
                      'settings-overlay',
                    )}
                  </SidebarMenu>
                  <div className="mt-2 h-px bg-border/60" aria-hidden />
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
            {recentSpaces.length > 0 ? (
              <SidebarGroup
                className={`${
                  spaceSettingsItem ? 'p-2 pb-4 pt-2' : 'mt-auto p-2 pb-4'
                }`}
              >
                <SidebarGroupContent>
                  <SidebarMenu className="gap-2">
                    {recentSpaces.map((space) =>
                      renderRecentSpaceItem(
                        space,
                        'expanded',
                        'recent-overlay',
                      ),
                    )}
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
        <SidebarHeader className="flex h-[var(--menu-top-height,70px)] min-w-0 flex-shrink-0 items-center justify-end border-b border-border bg-background-2 px-4 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-end">
            {triggerButton}
          </div>
        </SidebarHeader>
        <SidebarContent
          className="relative overflow-visible bg-background-2"
          onMouseEnter={handleCollapsedRegionMouseEnter}
          onMouseLeave={handleOverlayMouseLeave}
        >
          <SidebarGroup className="p-2 pt-4">
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {sectionNavItems.map((item) =>
                  renderSectionNavItem(item, 'collapsed', 'collapsed'),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {spaceSettingsItem ? (
            <SidebarGroup className="mt-auto p-2 pb-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {renderSectionNavItem(
                    spaceSettingsItem,
                    'collapsed',
                    'settings-collapsed',
                  )}
                </SidebarMenu>
                <div className="mt-2 h-px bg-border/60" aria-hidden />
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          {recentSpaces.length > 0 ? (
            <SidebarGroup
              className={`${
                spaceSettingsItem ? 'p-2 pb-4 pt-2' : 'mt-auto p-2 pb-4'
              }`}
            >
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {recentSpaces.map((space) =>
                    renderRecentSpaceItem(
                      space,
                      'collapsed',
                      'recent-collapsed',
                    ),
                  )}
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
          <AiPanelHeader
            showCloseButton={false}
            leftSlot={triggerButton}
            rightSlot={closeButton}
          />
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
          <AiPanelHeader
            showCloseButton={false}
            leftSlot={triggerButton}
            rightSlot={closeButton}
          />
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
        <AiPanelHeader
          showCloseButton={false}
          leftSlot={triggerButton}
          rightSlot={closeButton}
        />
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
