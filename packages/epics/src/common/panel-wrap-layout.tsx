'use client';

import { HYPHA_SCREEN_SHARE_CAPTURE_ROOT_ID } from '@hypha-platform/core/client';
import React, {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Menu,
  MessageCircle,
  PanelLeftClose,
  Phone,
  Sparkles,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarResizeHandle,
  useCompactPanelsMode,
  useIsMobile,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useJwt } from '@hypha-platform/core/client';
import {
  AiPanelProvider,
  HumanChatPanelProvider,
  useAiPanel,
  useHumanChatPanel,
} from './human-chat-panel-context';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { isInteractiveCreatePath } from './get-path-function';
import {
  isNetworkAiPath,
  showsHumanChatIcon,
  useIsNetworkContext,
  useIsSpaceContext,
} from './use-is-space-context';
import { useGlobalCallDock } from './global-call-dock-context';
import { useCallMembershipRegistry } from './human-chat-panel/use-call-membership-registry';
import { HumanChatPanelErrorBoundary } from './human-chat-panel/human-chat-panel-error-boundary';
import { shouldPreventChatSheetEscapeDismiss } from './human-chat-panel/composer-escape';
import { PanelDualSidebarScrollBridge } from './panel-main-column-scroll-bridge';
import { PanelScrollInset } from './panel-scroll-inset';
import { resolveSidebarInsetPx } from './panel-scroll-insets';
import { APP_CHROME_ICON_TRIGGER } from './chrome-radius';
import { useOpenSpacePublicChat } from './use-open-space-public-chat';

// ─── Panel Providers ─────────────────────────────────────────────────────────
// Owns the open/close state for both panels and wraps children with the
// context providers. This allows components outside PanelWrapLayout (like
// MenuTop) to access panel state via useAiPanel() and useHumanChatPanel().

export function PanelProviders({ children }: { children: React.ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [leftOverlayVisible, setLeftOverlayVisible] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const toggleRight = useCallback(() => setRightOpen((prev) => !prev), []);
  const openLeft = useCallback(() => {
    // Conversation open is not the nav menu. Leaving the menu flag true
    // made the collapsed icon rail look "open" after this panel closed.
    setLeftOpen(true);
    setLeftOverlayVisible(false);
  }, []);
  const closeLeft = useCallback(() => {
    setLeftOpen(false);
    setLeftOverlayVisible(false);
  }, []);
  const showLeftOverlay = useCallback(() => {
    // Ensure the compact overlay menu can open immediately from an expanded state.
    setLeftOpen(false);
    setLeftOverlayVisible(true);
  }, []);
  const setLeftOverlayVisibleImmediate = useCallback((visible: boolean) => {
    setLeftOverlayVisible(visible);
  }, []);
  const hideLeftOverlay = useCallback(() => {
    // Clear immediately. A delayed hide left the menu flag true after the
    // conversation closed; the collapsed icon rail is not that menu.
    setLeftOverlayVisible(false);
  }, []);
  const toggleLeftFromTrigger = useCallback(() => {
    setLeftOpen((prev) => {
      const next = !prev;
      // Trigger click controls chat panel visibility; hover controls overlay rail expansion.
      setLeftOverlayVisible(false);
      return next;
    });
  }, []);

  return (
    <AiPanelProvider
      value={{
        open: leftOpen,
        overlayVisible: leftOverlayVisible,
        toggle: toggleLeftFromTrigger,
        openAiPanel: openLeft,
        closeAiPanel: closeLeft,
        showAiOverlay: showLeftOverlay,
        hideAiOverlay: hideLeftOverlay,
        setAiOverlayVisible: setLeftOverlayVisibleImmediate,
      }}
    >
      <HumanChatPanelProvider
        open={rightOpen}
        toggle={toggleRight}
        setOpen={setRightOpen}
      >
        {children}
      </HumanChatPanelProvider>
    </AiPanelProvider>
  );
}

// ─── Trigger Buttons ─────────────────────────────────────────────────────────
// Both triggers use custom contexts (not useSidebar()) so they work correctly
// regardless of SidebarProvider nesting order.

function useMutuallyExclusivePanels(): boolean {
  const isCompactPanels = useCompactPanelsMode();
  const isMobile = useIsMobile();
  return isCompactPanels || isMobile === true;
}

/**
 * Messages inbox context icons deep-link with `?spaceChat=` or `?signal=`.
 * Opens the Human panel from the layout (always mounted) so the lazy panel
 * body can apply the channel / signal — do not wait for a prior manual open.
 */
function HumanChatDeepLinkOpener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openHumanChatPanel } = useHumanChatPanel();
  const spaceChatDeepLink = searchParams?.get('spaceChat')?.trim() ?? null;
  const signalDeepLink = searchParams?.get('signal')?.trim() ?? null;

  useEffect(() => {
    const opensSpaceChat =
      spaceChatDeepLink === 'space' ||
      spaceChatDeepLink === 'ecosystem' ||
      spaceChatDeepLink === 'public';
    const opensSignal = Boolean(signalDeepLink);
    if (!opensSpaceChat && !opensSignal) return;
    if (!getDhoSpaceSlugFromPathname(pathname)) return;
    openHumanChatPanel();
  }, [pathname, spaceChatDeepLink, signalDeepLink, openHumanChatPanel]);

  return null;
}

export function AiSidebarTrigger() {
  const { open, overlayVisible, showAiOverlay, hideAiOverlay, closeAiPanel } =
    useAiPanel();
  const { open: rightOpen, closeHumanChatPanel } = useHumanChatPanel();
  const isSpace = useIsSpaceContext();
  const pathname = usePathname();
  const isNetworkAi = isNetworkAiPath(pathname);
  const mutuallyExclusive = useMutuallyExclusivePanels();
  const t = useTranslations('AiPanel');

  if (!isSpace && !isNetworkAi) {
    return null;
  }

  const isMenuOpen = overlayVisible;

  return (
    <button
      type="button"
      onClick={() => {
        if (isMenuOpen) {
          hideAiOverlay();
          return;
        }
        if (mutuallyExclusive && rightOpen) {
          closeHumanChatPanel();
        }
        if (open) {
          closeAiPanel();
        }
        showAiOverlay();
      }}
      aria-expanded={isMenuOpen}
      className={APP_CHROME_ICON_TRIGGER}
      title={isMenuOpen ? t('closePanel') : t('openPanel')}
      aria-label={isMenuOpen ? t('closePanel') : t('openPanel')}
    >
      {isMenuOpen ? (
        <PanelLeftClose className="craft-icon" />
      ) : (
        <Menu className="craft-icon" />
      )}
    </button>
  );
}

export function AiPanelTrigger() {
  const { open, openAiPanel, closeAiPanel, setAiOverlayVisible } = useAiPanel();
  const { open: rightOpen, closeHumanChatPanel } = useHumanChatPanel();
  const isSpace = useIsSpaceContext();
  const pathname = usePathname();
  const isNetworkAi = isNetworkAiPath(pathname);
  const mutuallyExclusive = useMutuallyExclusivePanels();
  const t = useTranslations('AiPanel');

  if (!isSpace && !isNetworkAi) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (open) {
          closeAiPanel();
          return;
        }
        if (mutuallyExclusive && rightOpen) {
          closeHumanChatPanel();
        }
        openAiPanel();
        setAiOverlayVisible(false);
      }}
      aria-expanded={open}
      className={APP_CHROME_ICON_TRIGGER}
      title={open ? t('closeAiPanel') : t('openAiPanel')}
      aria-label={open ? t('closeAiPanel') : t('openAiPanel')}
    >
      <Sparkles className="craft-icon" />
    </button>
  );
}

export function HumanSidebarTrigger() {
  const {
    open,
    toggle,
    openHumanChatPanel,
    focusedSpaceChat,
    unreadMentionCount,
  } = useHumanChatPanel();
  const {
    openPublicChat,
    opening: openingPublicChat,
    error: publicChatError,
  } = useOpenSpacePublicChat();
  const { open: leftOpen, overlayVisible, closeAiPanel } = useAiPanel();
  const t = useTranslations('HumanChatPanel');
  const tCommon = useTranslations('Common');
  const publicChatErrorMessage =
    publicChatError === 'matrix'
      ? tCommon('signIn')
      : publicChatError === 'failed'
      ? t('failedToJoinRoom')
      : null;
  const pathname = usePathname();
  const isSpace = useIsSpaceContext();
  const isNetwork = useIsNetworkContext();
  const mutuallyExclusive = useMutuallyExclusivePanels();
  const { activeRoomId } = useGlobalCallDock();
  const { jwt } = useJwt();
  const elsewhereCallEntries = useCallMembershipRegistry({
    excludeRoomIds: [activeRoomId],
    getAccessToken: async () => jwt,
    hasAccessToken: Boolean(jwt),
  });
  const hasCallElsewhere = elsewhereCallEntries.length > 0;
  const hasUnreadMentions = isSpace && unreadMentionCount > 0;

  // Hide the header trigger while the panel is open. Unread mentions only exist in a space.
  if (!showsHumanChatIcon(pathname, isSpace, isNetwork) || open) return null;

  const openPanelLabel = hasUnreadMentions
    ? t('openPanelWithUnreadMentions')
    : t('openPanel');

  return (
    // `APP_CHROME_ICON_TRIGGER` has `overflow-hidden`, which clips a badge positioned
    // outside the icon's bounds — so the badge lives on this unclipped wrapper instead
    // of inside the button.
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          if (open) {
            toggle();
            return;
          }
          if (mutuallyExclusive && (leftOpen || overlayVisible)) {
            closeAiPanel();
          }
          if (focusedSpaceChat?.slug) {
            if (openingPublicChat) return;
            // Map-selected space: same public channel as Connect, not the
            // member room stored on `focusedSpaceChat.roomId`.
            void openPublicChat({
              slug: focusedSpaceChat.slug,
              title: focusedSpaceChat.title,
              description: focusedSpaceChat.description,
              memberRoomId: focusedSpaceChat.roomId,
            });
            return;
          }
          openHumanChatPanel();
        }}
        aria-expanded={open}
        aria-describedby={
          publicChatErrorMessage ? 'map-space-public-chat-error' : undefined
        }
        className={APP_CHROME_ICON_TRIGGER}
        title={openPanelLabel}
        aria-label={openPanelLabel}
      >
        <MessageCircle className="craft-icon" />
      </button>
      {publicChatErrorMessage ? (
        <p
          id="map-space-public-chat-error"
          role="status"
          className="absolute right-0 top-full z-20 mt-1 w-max max-w-56 border border-border bg-background px-2 py-1 text-1 text-neutral-11"
        >
          {publicChatErrorMessage}
        </p>
      ) : null}
      {hasCallElsewhere ? (
        <span className="pointer-events-none absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-9 opacity-60" />
          {/* h-4.5/w-4.5 isn't valid here — see the matching comment in
              human-chat-panel-elsewhere-call-indicator.tsx. */}
          <span className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full bg-success-9 ring-2 ring-background">
            <Phone className="h-3 w-3 text-white" strokeWidth={2.5} />
          </span>
        </span>
      ) : null}
      {hasUnreadMentions ? (
        <span
          className={
            hasCallElsewhere
              ? 'pointer-events-none absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-warning-9 ring-2 ring-background'
              : 'pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warning-9 ring-2 ring-background'
          }
          aria-hidden="true"
          data-testid="human-chat-unread-mention-dot"
        />
      ) : null}
    </span>
  );
}

// ─── Panel Slot Types ────────────────────────────────────────────────────────

type PanelSlot = {
  content: React.ReactNode;
};

type PanelWrapLayoutProps = {
  children: React.ReactNode;
  left?: PanelSlot;
  right?: PanelSlot;
};

/** Matches scroll inset — `0px` so fixed chrome / dividers span full main column (lines may cross overlay scrollbar). */
const MAIN_COLUMN_SCROLLBAR_WIDTH_CSS = '0px';
const PANEL_COMPACT_ATTR = 'data-compact-panels';
const PANEL_OPEN_ATTR = 'data-side-panels-open';
const LEFT_PANEL_EXPANDED_ATTR = 'data-left-panel-expanded';
const LEFT_SIDEBAR_EXPANDED_WIDTH = '320px';
const LEFT_AI_PANEL_WIDTH_PX = 320;
const LEFT_SIDEBAR_ICON_WIDTH_PX = 72;
const RIGHT_SIDEBAR_WIDTH = '320px';
// Mobile: keep only a slim gutter so chat/menu content uses almost full width.
const RIGHT_SIDEBAR_WIDTH_COMPACT = 'min(560px, calc(100vw - 16px))';
const DUAL_PANEL_MIN_VIEWPORT_PX = 1200;
const MIN_MAIN_COLUMN_WIDTH_PX = 560;
const MOBILE_PANEL_BREAKPOINT_PX = 768;

const SIDEBAR_WIDTH_MIRROR_KEYS = [
  '--sidebar-left-width',
  '--sidebar-right-width',
  '--main-column-scrollbar-width',
] as const;
const LEFT_SIDEBAR_ICON_WIDTH = '72px';

function mirrorMainColumnLayoutVarsToDocument(
  sidebarLeftPx: string,
  sidebarRightPx: string,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--sidebar-left-width', sidebarLeftPx);
  root.style.setProperty('--sidebar-right-width', sidebarRightPx);
  root.style.setProperty(
    '--main-column-scrollbar-width',
    MAIN_COLUMN_SCROLLBAR_WIDTH_CSS,
  );
}

function clearMainColumnLayoutMirrorFromDocument(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of SIDEBAR_WIDTH_MIRROR_KEYS) {
    root.style.removeProperty(key);
  }
}

// ─── Main Layout ─────────────────────────────────────────────────────────────
// Reads panel open/close state from PanelProviders contexts. Creates
// SidebarProvider wrappers for each side to drive sidebar animations.
// Sets CSS variables --sidebar-right-width and --sidebar-left-width
// on its outermost div so other components (e.g. SidePanel) can position
// themselves relative to the sidebars.
//
// Must be rendered inside <PanelProviders>.
//
// Keep sidebars above `ProposalOverlayShell` scrim (`z-40`) so chat/AI panels stay
// interactive while proposal modals are open (`modal={false}` on that dialog).

export function PanelWrapLayout({
  children,
  left,
  right,
}: PanelWrapLayoutProps) {
  const pathname = usePathname();
  const {
    open: leftOpen,
    overlayVisible: leftOverlayVisible,
    openAiPanel,
    closeAiPanel,
  } = useAiPanel();
  const {
    open: rightOpen,
    openHumanChatPanel,
    closeHumanChatPanel,
  } = useHumanChatPanel();
  const isSpace = useIsSpaceContext();
  const isNetwork = useIsNetworkContext();
  const isOnboarding = isInteractiveCreatePath(pathname);
  /** Space ecosystem AI, or shared Network AI (home / messages / wallet / my-spaces / network). */
  const showAiPanel = isSpace || isNetworkAiPath(pathname);
  const effectiveLeft = showAiPanel ? left : undefined;
  // The chat icon is on home, connections, my spaces, my wallet, a space, and the network.
  const showHumanChat = showsHumanChatIcon(pathname, isSpace, isNetwork);
  const effectiveRight = showHumanChat ? right : undefined;

  // Close when the route leaves home, connections, my spaces, my wallet, a space, or the network. Does not run again
  // if something opens the panel while already outside a space and then
  // navigates into one (the call dock opens chat and pushes the space route
  // together).
  useEffect(() => {
    if (!showHumanChat) {
      closeHumanChatPanel();
    }
  }, [showHumanChat, closeHumanChatPanel]);

  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return MOBILE_PANEL_BREAKPOINT_PX;
    }
    return window.innerWidth;
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const leftExpanded = Boolean(leftOpen || leftOverlayVisible);
  const isMobileViewport = viewportWidth < MOBILE_PANEL_BREAKPOINT_PX;
  // Desktop conversation sits beside the icon rail, so the left track is
  // rail + panel. The hamburger menu still replaces the rail and stays 320px.
  // Below md the sheet stays full width and does not reserve a rail column.
  // Collapsed icon rail hides below xl via Sidebar CSS (spaces rail owns that band).
  const dockIconRailBesideAi =
    !isOnboarding && !isMobileViewport && leftOpen && !leftOverlayVisible;
  const leftIconRailPx = dockIconRailBesideAi ? LEFT_SIDEBAR_ICON_WIDTH_PX : 0;
  const leftExpandedWidthPx = LEFT_AI_PANEL_WIDTH_PX + leftIconRailPx;
  // Mobile sheets do not reserve a column — footprint stays 0 so dual-panel
  // compact math and fixed chrome insets stay aligned with the full-width column.
  const leftFootprintPx =
    isOnboarding || isMobileViewport
      ? 0
      : leftExpanded
      ? leftExpandedWidthPx
      : showAiPanel
      ? LEFT_SIDEBAR_ICON_WIDTH_PX
      : 0;
  const rightFootprintPx =
    isMobileViewport || !(rightOpen && effectiveRight) ? 0 : 320;
  const forceCompactPanels =
    Boolean(effectiveLeft && effectiveRight) &&
    (viewportWidth < DUAL_PANEL_MIN_VIEWPORT_PX ||
      viewportWidth - leftFootprintPx - rightFootprintPx <
        MIN_MAIN_COLUMN_WIDTH_PX);
  const isMutuallyExclusivePanels =
    Boolean(effectiveLeft && effectiveRight) &&
    (forceCompactPanels || isMobileViewport);
  // Panel compact mode is viewport-driven only — do not conflate with header
  // compact (MenuTop overflow), or opening one panel shrinks the center column
  // and incorrectly closes the opposite panel on desktop widths.
  const isCompactPanels = forceCompactPanels;
  const rightSidebarWidth = isCompactPanels
    ? isMobileViewport
      ? RIGHT_SIDEBAR_WIDTH_COMPACT
      : RIGHT_SIDEBAR_WIDTH
    : RIGHT_SIDEBAR_WIDTH;
  const leftExpandedSidebarWidth = isOnboarding
    ? '100vw'
    : dockIconRailBesideAi
    ? `${leftExpandedWidthPx}px`
    : LEFT_SIDEBAR_EXPANDED_WIDTH;
  const fallbackSidebarLeftPx =
    !effectiveLeft || isOnboarding || isMobileViewport
      ? '0px'
      : leftExpanded
      ? leftExpandedSidebarWidth
      : showAiPanel
      ? LEFT_SIDEBAR_ICON_WIDTH
      : '0px';
  const fallbackSidebarRightPx =
    isMobileViewport || !(rightOpen && effectiveRight)
      ? '0px'
      : rightSidebarWidth;
  const [sidebarLeftPx, setSidebarLeftPx] = useState(fallbackSidebarLeftPx);
  const [sidebarRightPx, setSidebarRightPx] = useState(fallbackSidebarRightPx);

  // Before paint — SSR hydrates with a mobile width; correct it here so the
  // desktop icon rail is not stuck offcanvas until the user resizes.
  useLayoutEffect(() => {
    setViewportWidth(window.innerWidth);
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    setSidebarLeftPx(fallbackSidebarLeftPx);
  }, [fallbackSidebarLeftPx]);

  useLayoutEffect(() => {
    setSidebarRightPx(fallbackSidebarRightPx);
  }, [fallbackSidebarRightPx]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute(PANEL_COMPACT_ATTR, isCompactPanels ? 'true' : 'false');
    root.setAttribute(
      'data-mutually-exclusive-panels',
      isMutuallyExclusivePanels ? 'true' : 'false',
    );
    return () => {
      root.removeAttribute(PANEL_COMPACT_ATTR);
      root.removeAttribute('data-mutually-exclusive-panels');
      root.removeAttribute(PANEL_OPEN_ATTR);
      root.removeAttribute(LEFT_PANEL_EXPANDED_ATTR);
    };
  }, [isCompactPanels, isMutuallyExclusivePanels]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const hasOpenSidePanel =
      Boolean(effectiveLeft && leftExpanded) ||
      Boolean(effectiveRight && rightOpen);
    root.setAttribute(PANEL_OPEN_ATTR, hasOpenSidePanel ? 'true' : 'false');
    root.setAttribute(
      LEFT_PANEL_EXPANDED_ATTR,
      effectiveLeft && leftExpanded ? 'true' : 'false',
    );
  }, [effectiveLeft, leftExpanded, effectiveRight, rightOpen]);

  useEffect(() => {
    if (!isMutuallyExclusivePanels) return;
    if (leftExpanded && rightOpen) {
      // Prefer the left panel when both are open on mobile / compact widths.
      closeHumanChatPanel();
    }
  }, [isMutuallyExclusivePanels, leftExpanded, rightOpen, closeHumanChatPanel]);

  useLayoutEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const readSidebarWidths = () => {
      const gaps = root.querySelectorAll<HTMLElement>('[data-sidebar-gap]');
      let nextLeft = 0;
      let nextRight = 0;
      let hasLeftGap = false;
      let hasRightGap = false;

      gaps.forEach((gap) => {
        const host = gap.closest<HTMLElement>('[data-side]');
        const side = host?.getAttribute('data-side');
        const width = Math.round(gap.getBoundingClientRect().width);
        if (!Number.isFinite(width) || width < 0) return;
        if (side === 'right') {
          hasRightGap = true;
          nextRight = Math.max(nextRight, width);
          return;
        }
        hasLeftGap = true;
        nextLeft = Math.max(nextLeft, width);
      });

      const resolvedLeft = resolveSidebarInsetPx({
        isOnboarding,
        isMobileViewport,
        sideActive: Boolean(effectiveLeft),
        measuredPx: nextLeft,
        hasGapNodes: hasLeftGap,
        fallbackPx: fallbackSidebarLeftPx,
      });
      const resolvedRight = resolveSidebarInsetPx({
        isOnboarding: false,
        isMobileViewport,
        sideActive: Boolean(effectiveRight),
        measuredPx: nextRight,
        hasGapNodes: hasRightGap,
        fallbackPx: fallbackSidebarRightPx,
      });

      setSidebarLeftPx((prev) => (prev === resolvedLeft ? prev : resolvedLeft));
      setSidebarRightPx((prev) =>
        prev === resolvedRight ? prev : resolvedRight,
      );
    };

    const resizeObserver = new ResizeObserver(readSidebarWidths);
    const observeGaps = () => {
      resizeObserver.disconnect();
      const gaps = root.querySelectorAll<HTMLElement>('[data-sidebar-gap]');
      gaps.forEach((gap) => resizeObserver.observe(gap));
      readSidebarWidths();
    };

    const mutationObserver = new MutationObserver(observeGaps);
    mutationObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'data-collapsible', 'style'],
    });

    window.addEventListener('resize', readSidebarWidths);
    observeGaps();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', readSidebarWidths);
    };
  }, [
    effectiveLeft,
    effectiveRight,
    fallbackSidebarLeftPx,
    fallbackSidebarRightPx,
    isMobileViewport,
    isOnboarding,
  ]);

  /** Radix portaled dialogs sit under `body` and do not inherit vars from this div — mirror to `:root`. */
  useLayoutEffect(() => {
    mirrorMainColumnLayoutVarsToDocument(sidebarLeftPx, sidebarRightPx);
    return () => {
      clearMainColumnLayoutMirrorFromDocument();
    };
  }, [sidebarLeftPx, sidebarRightPx]);

  // Core content that goes inside the scrollable SidebarInset (when panels wrap layout)
  let content = <>{children}</>;

  if (effectiveLeft && effectiveRight) {
    content = (
      <PanelDualSidebarScrollBridge
        leftOpen={leftExpanded}
        leftPanelOpen={leftOpen}
        leftSidebarWidth={leftExpandedSidebarWidth}
        leftIconRailPx={leftIconRailPx}
        onLeftOpenChange={(open) => {
          if (open === leftExpanded) return;
          if (open) {
            if (isMutuallyExclusivePanels && rightOpen) {
              closeHumanChatPanel();
            }
            openAiPanel();
            return;
          }
          closeAiPanel();
        }}
        rightOpen={rightOpen}
        onRightOpenChange={(open) => {
          if (open && isMutuallyExclusivePanels && leftExpanded) {
            closeAiPanel();
          }
          if (open) {
            openHumanChatPanel();
          } else {
            closeHumanChatPanel();
          }
        }}
        rightSidebarWidth={rightSidebarWidth}
        leftContent={effectiveLeft.content}
        rightContent={effectiveRight.content}
      >
        {content}
      </PanelDualSidebarScrollBridge>
    );
  } else if (effectiveRight) {
    content = (
      <SidebarProvider
        defaultOpen={false}
        open={rightOpen}
        onOpenChange={(open) => {
          if (open && isMutuallyExclusivePanels && leftExpanded) {
            closeAiPanel();
          }
          if (open) {
            openHumanChatPanel();
          } else {
            closeHumanChatPanel();
          }
        }}
        style={
          {
            '--sidebar-width': rightSidebarWidth,
          } as React.CSSProperties
        }
      >
        <PanelScrollInset className="overflow-y-auto">
          {content}
        </PanelScrollInset>
        <Sidebar
          side="right"
          variant="sidebar"
          collapsible="offcanvas"
          mobileWidth="100vw"
          className="z-[50]"
          shouldPreventEscapeDismiss={shouldPreventChatSheetEscapeDismiss}
        >
          <SidebarResizeHandle />
          <HumanChatPanelErrorBoundary>
            {effectiveRight.content}
          </HumanChatPanelErrorBoundary>
        </Sidebar>
      </SidebarProvider>
    );
  } else if (effectiveLeft) {
    const leftCollapsibleMode = isOnboarding ? 'offcanvas' : 'icon';
    const leftIconWidth = isOnboarding ? '0px' : LEFT_SIDEBAR_ICON_WIDTH;
    content = (
      <SidebarProvider
        defaultOpen={false}
        open={leftExpanded}
        onOpenChange={(open) => {
          if (open === leftExpanded) return;
          if (open) {
            if (isMutuallyExclusivePanels && rightOpen) {
              closeHumanChatPanel();
            }
            openAiPanel();
            return;
          }
          closeAiPanel();
        }}
        style={
          {
            '--sidebar-width': leftExpandedSidebarWidth,
            '--sidebar-width-icon': leftIconWidth,
          } as React.CSSProperties
        }
      >
        <Sidebar
          side="left"
          variant="sidebar"
          collapsible={leftCollapsibleMode}
          mobileWidth={leftExpanded || isOnboarding ? '100vw' : undefined}
          className="z-[50] overflow-visible"
        >
          {effectiveLeft.content}
          {!isOnboarding ? (
            <SidebarResizeHandle
              minWidth={280 + leftIconRailPx}
              maxWidth={600 + leftIconRailPx}
              defaultWidth={320 + leftIconRailPx}
            />
          ) : null}
        </Sidebar>
        <PanelScrollInset className="overflow-y-auto">
          {content}
        </PanelScrollInset>
      </SidebarProvider>
    );
  }

  return (
    <div
      id={HYPHA_SCREEN_SHARE_CAPTURE_ROOT_ID}
      className="craft-page-canvas isolate min-w-0 overflow-x-clip"
      ref={wrapperRef}
      style={
        {
          '--sidebar-right-width': sidebarRightPx,
          '--sidebar-left-width': sidebarLeftPx,
          '--panel-left-inset': sidebarLeftPx,
          '--panel-right-inset': `calc(${sidebarRightPx} + ${MAIN_COLUMN_SCROLLBAR_WIDTH_CSS})`,
        } as React.CSSProperties
      }
    >
      <Suspense fallback={null}>
        <HumanChatDeepLinkOpener />
      </Suspense>
      {content}
    </div>
  );
}
