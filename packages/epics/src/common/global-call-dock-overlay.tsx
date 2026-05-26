'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Expand,
  Loader2,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Shrink,
} from 'lucide-react';
import {
  useMatrix,
  useMe,
  type SpaceGroupCallCaptureMode,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter } from 'next/navigation';
import {
  DEFAULT_CALL_FULL_VIEW_LAYOUT,
  HumanChatPanelCallBanner,
  HumanChatPanelCaptureConsentBanner,
  HumanChatPanelCallStage,
  HumanChatPanelCallFullViewLayoutMenu,
  HumanChatPanelInCallControls,
  HumanChatPanelScreenshareTakeoverDialog,
  readCallFullViewLayoutFromStorage,
  persistCallFullViewLayout,
  type CallFullViewLayoutMode,
  type CallFullViewPaneSplit,
  readCallFullViewPaneSplit,
  persistCallFullViewPaneSplit,
} from './human-chat-panel';
import { matrixMemberDisplayLabelFromRoom } from './human-chat-panel/matrix-room-member-display';
import { resolveSignalThreadByMatrixRoom } from './human-chat-panel/resolve-signal-thread-by-matrix-room';
import { useGlobalCallDock } from './global-call-dock-context';
import { useHumanChatPanel } from './human-chat-panel-context';
import { getLocaleFromPath } from './get-locale-from-path';
import { useCallDockDocumentPip } from './use-call-dock-document-pip';
import { useCallDocumentKeepalive } from './use-call-document-keepalive';
import { useSpaceAccentPortalStyles } from '../spaces/components/space-accent-portal-context';

type DockGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type ResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left';

const DOCK_GEOMETRY_KEY = 'hypha-global-call-dock-geometry-v2';
const DOCK_MARGIN_PX = 16;
const SNAP_EDGE_PX = 24;
// Minimum dock size (thumbnail mode baseline); resize can never go below this.
const DOCK_MIN_WIDTH = 480;
const DOCK_MIN_HEIGHT = 320;
/** Keep the dock in a usable video-call aspect range and avoid extreme sizes. */
const DOCK_MAX_WIDTH = 880;
const DOCK_MAX_HEIGHT = 640;
const DOCK_MIN_WIDTH_TO_HEIGHT = 1.05;
const DOCK_MAX_WIDTH_TO_HEIGHT = 1.85;
const THUMBNAIL_GEOMETRY: Pick<DockGeometry, 'width' | 'height'> = {
  width: DOCK_MIN_WIDTH,
  height: DOCK_MIN_HEIGHT,
};
const EXPANDED_GEOMETRY: Pick<DockGeometry, 'width' | 'height'> = {
  width: 640,
  height: 420,
};
const DEFAULT_PANE_SPLIT: Record<CallFullViewPaneSplit, number> = {
  sideBySide: 0.68,
  filmstrip: 0.72,
  speakerOnTop: 0.28,
};
const SESSION_ROOM_TO_SPACE_PREFIX = 'hypha-room-to-space-';

function readCallSpaceSlug(
  pinnedSpaceSlug: string | null,
  activeSpaceSlug: string | null,
  activeRoomId: string | null,
): string | null {
  const fromPinned = pinnedSpaceSlug?.trim();
  if (fromPinned) return fromPinned;
  const fromState = activeSpaceSlug?.trim();
  if (fromState) return fromState;
  if (!activeRoomId?.trim() || typeof window === 'undefined') return null;
  try {
    return (
      window.sessionStorage
        .getItem(`${SESSION_ROOM_TO_SPACE_PREFIX}${activeRoomId.trim()}`)
        ?.trim() || null
    );
  } catch {
    return null;
  }
}

/**
 * Resize a dock anchored with `right`/`bottom` plus `translate(x, y)`.
 * Positive x/y moves the dock toward the viewport bottom-right corner.
 */
function applyDockResize(
  handle: ResizeHandle,
  start: DockGeometry,
  dx: number,
  dy: number,
): DockGeometry {
  let { x, y, width, height } = start;

  switch (handle) {
    case 'top-left':
      width = start.width - dx;
      height = start.height - dy;
      break;
    case 'top-right':
      width = start.width + dx;
      height = start.height - dy;
      x = start.x + dx;
      break;
    case 'bottom-left':
      width = start.width - dx;
      height = start.height + dy;
      y = start.y + dy;
      break;
    case 'bottom-right':
      width = start.width + dx;
      height = start.height + dy;
      x = start.x + dx;
      y = start.y + dy;
      break;
    case 'top':
      height = start.height - dy;
      break;
    case 'bottom':
      height = start.height + dy;
      y = start.y + dy;
      break;
    case 'left':
      width = start.width - dx;
      break;
    case 'right':
      width = start.width + dx;
      x = start.x + dx;
      break;
  }

  return clampDockGeometry({ x, y, width, height });
}

function DockCornerGrip({ corner }: { corner: ResizeHandle }) {
  const grip =
    corner === 'top-left' ? (
      <>
        <path
          d="M2 10V2h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M3.5 10V3.5h6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    ) : corner === 'top-right' ? (
      <>
        <path
          d="M10 10V2H2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M8.5 10V3.5H2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    ) : corner === 'bottom-left' ? (
      <>
        <path
          d="M2 2v8h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M3.5 3.5v6.5h6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    ) : (
      <>
        <path
          d="M10 2v8H2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M8.5 3.5v6.5H2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    );

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className="pointer-events-none text-foreground/60"
      aria-hidden
    >
      {grip}
    </svg>
  );
}

function DockResizeHandle({
  handle,
  ariaLabel,
  onResizeStart,
}: {
  handle: ResizeHandle;
  ariaLabel: string;
  onResizeStart: (
    handle: ResizeHandle,
  ) => (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const isCorner =
    handle === 'top-left' ||
    handle === 'top-right' ||
    handle === 'bottom-left' ||
    handle === 'bottom-right';
  const positionClass =
    handle === 'top-left'
      ? 'left-0 top-0 z-[4] h-4 w-4 cursor-nwse-resize'
      : handle === 'top-right'
      ? 'right-0 top-0 z-[4] h-4 w-4 cursor-nesw-resize'
      : handle === 'bottom-left'
      ? 'left-0 bottom-0 z-[4] h-4 w-4 cursor-nesw-resize'
      : handle === 'bottom-right'
      ? 'right-0 bottom-0 z-[4] h-4 w-4 cursor-nwse-resize'
      : handle === 'top'
      ? 'left-4 right-4 top-0 z-[3] h-2 cursor-ns-resize'
      : handle === 'bottom'
      ? 'left-4 right-4 bottom-0 z-[3] h-2 cursor-ns-resize'
      : handle === 'left'
      ? 'bottom-4 left-0 top-4 z-[3] w-2 cursor-ew-resize'
      : 'bottom-4 right-0 top-4 z-[3] w-2 cursor-ew-resize';

  return (
    <div
      data-no-dock-drag
      data-resize-handle={handle}
      onPointerDown={onResizeStart(handle)}
      className={cn(
        'absolute flex touch-none items-center justify-center',
        positionClass,
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {isCorner ? <DockCornerGrip corner={handle} /> : null}
    </div>
  );
}

function getDockOffsetBounds(width: number, height: number) {
  if (typeof window === 'undefined') {
    return { minX: -1000, maxX: 0, minY: -1000, maxY: 0 };
  }
  const maxX = 0;
  const maxY = 0;
  const minX = 2 * DOCK_MARGIN_PX - window.innerWidth + width;
  const minY = 2 * DOCK_MARGIN_PX - window.innerHeight + height;
  return { minX, maxX, minY, maxY };
}

function clampDockGeometry(next: DockGeometry): DockGeometry {
  const viewportMaxWidth =
    typeof window === 'undefined'
      ? DOCK_MAX_WIDTH
      : Math.max(DOCK_MIN_WIDTH, window.innerWidth - 2 * DOCK_MARGIN_PX);
  const viewportMaxHeight =
    typeof window === 'undefined'
      ? DOCK_MAX_HEIGHT
      : Math.max(DOCK_MIN_HEIGHT, window.innerHeight - 2 * DOCK_MARGIN_PX);
  const maxWidth = Math.min(DOCK_MAX_WIDTH, viewportMaxWidth);
  const maxHeight = Math.min(DOCK_MAX_HEIGHT, viewportMaxHeight);
  const minWidth = Math.min(DOCK_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(DOCK_MIN_HEIGHT, maxHeight);
  const safeWidth = Number.isFinite(next.width) ? next.width : minWidth;
  const safeHeight = Number.isFinite(next.height) ? next.height : minHeight;
  const safeX = Number.isFinite(next.x) ? next.x : 0;
  const safeY = Number.isFinite(next.y) ? next.y : 0;
  let width = Math.min(Math.max(safeWidth, minWidth), maxWidth);
  let height = Math.min(Math.max(safeHeight, minHeight), maxHeight);
  const ratio = width / height;
  if (ratio > DOCK_MAX_WIDTH_TO_HEIGHT) {
    height = Math.max(minHeight, width / DOCK_MAX_WIDTH_TO_HEIGHT);
  } else if (ratio < DOCK_MIN_WIDTH_TO_HEIGHT) {
    width = Math.max(minWidth, height * DOCK_MIN_WIDTH_TO_HEIGHT);
  }
  width = Math.min(Math.max(width, minWidth), maxWidth);
  height = Math.min(Math.max(height, minHeight), maxHeight);
  const bounds = getDockOffsetBounds(width, height);
  return {
    width,
    height,
    x: Math.min(Math.max(safeX, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(safeY, bounds.minY), bounds.maxY),
  };
}

function snapDockGeometry(next: DockGeometry): DockGeometry {
  const bounds = getDockOffsetBounds(next.width, next.height);
  let x = next.x;
  let y = next.y;
  if (Math.abs(x - bounds.maxX) <= SNAP_EDGE_PX) x = bounds.maxX;
  if (Math.abs(x - bounds.minX) <= SNAP_EDGE_PX) x = bounds.minX;
  if (Math.abs(y - bounds.maxY) <= SNAP_EDGE_PX) y = bounds.maxY;
  if (Math.abs(y - bounds.minY) <= SNAP_EDGE_PX) y = bounds.minY;
  return { ...next, x, y };
}

function readDockGeometry(): DockGeometry {
  if (typeof window === 'undefined') {
    return {
      x: 0,
      y: 0,
      width: THUMBNAIL_GEOMETRY.width,
      height: THUMBNAIL_GEOMETRY.height,
    };
  }
  try {
    const raw = window.localStorage.getItem(DOCK_GEOMETRY_KEY);
    if (!raw) {
      return {
        x: 0,
        y: 0,
        width: THUMBNAIL_GEOMETRY.width,
        height: THUMBNAIL_GEOMETRY.height,
      };
    }
    const parsed = JSON.parse(raw) as Partial<DockGeometry>;
    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : 0,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : 0,
      width: Number.isFinite(parsed.width)
        ? Number(parsed.width)
        : THUMBNAIL_GEOMETRY.width,
      height: Number.isFinite(parsed.height)
        ? Number(parsed.height)
        : THUMBNAIL_GEOMETRY.height,
    };
  } catch {
    return {
      x: 0,
      y: 0,
      width: THUMBNAIL_GEOMETRY.width,
      height: THUMBNAIL_GEOMETRY.height,
    };
  }
}

function persistDockGeometry(next: DockGeometry): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOCK_GEOMETRY_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence failure
  }
}

export function GlobalCallDockOverlay() {
  const t = useTranslations('GlobalCallDock');
  const tCapture = useTranslations('HumanChatPanel');
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { openHumanChatPanel, openCoherenceChat } = useHumanChatPanel();
  const { client } = useMatrix();
  const { person: me } = useMe();
  const {
    activeRoomId,
    activeSpaceSlug,
    pinnedCallSpaceSlug,
    showFloatingDock,
    dockMode,
    setDockMode,
    callState,
    callKind,
    errorCode,
    screenshareErrorCode,
    dismissScreenshareError,
    dismissCallError,
    retryFromError,
    isLocalVideoMuted,
    isScreensharing,
    tabBackgroundWhileInCall,
    othersInRoomCallCount,
    remoteMediaStall,
    dismissRemoteMediaStallBanner,
    feedVersion,
    activeSpeakerKey,
    inCallUserIdsForRoster,
    groupCall,
    roomGroupCallDeviceCount,
    isMicrophoneMuted,
    setMicrophoneMuted,
    setCameraMuted,
    setScreensharingEnabled,
    screenshareTakeoverIncoming,
    screenshareTakeoverPendingId,
    screenshareTakeoverDenied,
    approveScreenshareTakeover,
    denyScreenshareTakeover,
    cancelScreenshareTakeoverRequest,
    dismissScreenshareTakeoverPrompt,
    voiceProcessingPreset,
    setVoiceProcessingPreset,
    captureMode,
    capturePreference,
    capturePreferenceSelected,
    setCapturePreference,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    recordingStatus,
    recordingError,
    recordingWarning,
    canRetryRecordingUpload,
    retryRecordingUpload,
    captureConsent,
    leave,
  } = useGlobalCallDock();

  const [layoutMode, setLayoutMode] = React.useState<CallFullViewLayoutMode>(
    DEFAULT_CALL_FULL_VIEW_LAYOUT,
  );
  const [paneSplit, setPaneSplit] = React.useState<{
    sideBySide: number;
    filmstrip: number;
    speakerOnTop: number;
  }>(DEFAULT_PANE_SPLIT);
  const [geometry, setGeometry] = React.useState<DockGeometry>(
    clampDockGeometry({
      x: 0,
      y: 0,
      width: THUMBNAIL_GEOMETRY.width,
      height: THUMBNAIL_GEOMETRY.height,
    }),
  );
  const [dockStorageHydrated, setDockStorageHydrated] = React.useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const dockRef = React.useRef<HTMLDivElement | null>(null);
  const lastNonFullscreenModeRef = React.useRef<'thumbnail' | 'expanded'>(
    dockMode === 'fullscreen' ? 'thumbnail' : dockMode,
  );
  const modeGeometryRef = React.useRef<{
    thumbnail: DockGeometry | null;
    expanded: DockGeometry | null;
  }>({
    thumbnail: null,
    expanded: null,
  });
  const persistTimeoutRef = React.useRef<number | null>(null);
  const latestGeometryRef = React.useRef<DockGeometry>(geometry);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const resizeRef = React.useRef<{
    pointerId: number;
    handle: ResizeHandle;
    startX: number;
    startY: number;
    startGeometry: DockGeometry;
  } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const {
    pipWindow,
    isSupported: isDocumentPipSupported,
    isOpen: isDocumentPipOpen,
    openPip,
    closePip,
  } = useCallDockDocumentPip(dockRef);
  const spaceAccentStyles = useSpaceAccentPortalStyles();
  const callMediaActive =
    callState === 'connected' ||
    callState === 'connecting' ||
    callState === 'awaiting_media' ||
    callState === 'initializing';
  useCallDocumentKeepalive(callMediaActive, isDocumentPipOpen);
  const currentUserId = client?.getUserId?.() ?? null;
  const currentUserDisplayName = React.useMemo(() => {
    const profile = (me ?? null) as {
      name?: string | null;
      surname?: string | null;
      nickname?: string | null;
    } | null;
    const full = [profile?.name, profile?.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (full) return full;
    return profile?.nickname?.trim() || '';
  }, [me]);

  React.useEffect(() => {
    setLayoutMode(readCallFullViewLayoutFromStorage());
  }, []);

  React.useEffect(() => {
    if (!isScreensharing || roomGroupCallDeviceCount <= 1) return;
    setLayoutMode('sideBySide');
    persistCallFullViewLayout('sideBySide');
  }, [isScreensharing, roomGroupCallDeviceCount]);

  const onShareLayoutModeChange = React.useCallback(
    (mode: CallFullViewLayoutMode) => {
      persistCallFullViewLayout(mode);
      setLayoutMode(mode);
    },
    [],
  );

  React.useEffect(() => {
    setPaneSplit({
      sideBySide: readCallFullViewPaneSplit('sideBySide'),
      filmstrip: readCallFullViewPaneSplit('filmstrip'),
      speakerOnTop: readCallFullViewPaneSplit('speakerOnTop'),
    });
    setGeometry(clampDockGeometry(readDockGeometry()));
    setDockStorageHydrated(true);
  }, []);

  const onPaneSplitChange = React.useCallback(
    (which: CallFullViewPaneSplit, value: number) => {
      persistCallFullViewPaneSplit(which, value);
      setPaneSplit((prev) => ({ ...prev, [which]: value }));
    },
    [],
  );

  React.useEffect(() => {
    if (!dockStorageHydrated) return;
    const clamped = clampDockGeometry(geometry);
    latestGeometryRef.current = clamped;
    if (persistTimeoutRef.current != null) {
      window.clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = window.setTimeout(() => {
      persistDockGeometry(clamped);
      persistTimeoutRef.current = null;
    }, 180);
    return () => {
      if (persistTimeoutRef.current != null) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [dockStorageHydrated, geometry]);

  React.useEffect(() => {
    return () => {
      persistDockGeometry(clampDockGeometry(latestGeometryRef.current));
    };
  }, []);

  React.useEffect(() => {
    if (dockMode === 'fullscreen') return;
    const onResize = () => {
      setGeometry((prev) => clampDockGeometry(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dockMode]);

  React.useEffect(() => {
    if (dockMode === 'fullscreen') return;
    modeGeometryRef.current[dockMode] = clampDockGeometry(geometry);
  }, [dockMode, geometry]);

  React.useEffect(() => {
    if (!isDragging && !isResizing) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && e.pointerId === drag.pointerId) {
        setGeometry((prev) =>
          clampDockGeometry({
            ...prev,
            x: drag.startOffsetX + (e.clientX - drag.startX),
            y: drag.startOffsetY + (e.clientY - drag.startY),
          }),
        );
      }

      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;
      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;
      setGeometry(applyDockResize(resize.handle, resize.startGeometry, dx, dy));
    };

    const onEnd = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && e.pointerId === drag.pointerId) {
        dragRef.current = null;
        setIsDragging(false);
      }
      const resize = resizeRef.current;
      if (resize && e.pointerId === resize.pointerId) {
        resizeRef.current = null;
        setIsResizing(false);
      }
      setGeometry((prev) => snapDockGeometry(clampDockGeometry(prev)));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [isDragging, isResizing]);

  const onDragStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dockMode === 'fullscreen') return;
      const target = e.target as HTMLElement;
      if (target.closest('button,[data-no-dock-drag]')) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: geometry.x,
        startOffsetY: geometry.y,
      };
      setIsDragging(true);
    },
    [dockMode, geometry.x, geometry.y],
  );

  const onResizeStart = React.useCallback(
    (handle: ResizeHandle) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (dockMode === 'fullscreen') return;
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        pointerId: e.pointerId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startGeometry: geometry,
      };
      setIsResizing(true);
    },
    [dockMode, geometry],
  );

  const applyDockMode = React.useCallback(
    (nextMode: 'thumbnail' | 'expanded') => {
      const preset =
        nextMode === 'thumbnail' ? THUMBNAIL_GEOMETRY : EXPANDED_GEOMETRY;
      const saved = modeGeometryRef.current[nextMode];
      setGeometry((prev) =>
        clampDockGeometry(
          nextMode === 'thumbnail'
            ? {
                ...(saved ?? prev),
                width: preset.width,
                height: preset.height,
              }
            : saved
            ? saved
            : {
                ...prev,
                width: preset.width,
                height: preset.height,
              },
        ),
      );
      setDockMode(nextMode);
      lastNonFullscreenModeRef.current = nextMode;
    },
    [setDockMode],
  );

  const onToggleFullscreen = React.useCallback(() => {
    if (dockMode === 'fullscreen') {
      applyDockMode(lastNonFullscreenModeRef.current ?? 'thumbnail');
      return;
    }
    if (dockMode === 'thumbnail' || dockMode === 'expanded') {
      lastNonFullscreenModeRef.current = dockMode;
    }
    setDockMode('fullscreen');
  }, [applyDockMode, dockMode, setDockMode]);

  React.useEffect(() => {
    if (!showFloatingDock) {
      closePip();
    }
  }, [closePip, showFloatingDock]);

  const onToggleDocumentPip = React.useCallback(async () => {
    if (isDocumentPipOpen) {
      closePip();
      return;
    }
    await openPip();
  }, [closePip, isDocumentPipOpen, openPip]);

  const resolveMemberLabel = React.useCallback(
    (userId: string | undefined) => {
      if (
        userId?.trim() &&
        currentUserId &&
        userId === currentUserId &&
        currentUserDisplayName
      ) {
        return currentUserDisplayName;
      }
      if (!userId?.trim()) return t('unknownMember');
      return matrixMemberDisplayLabelFromRoom(client, activeRoomId, userId);
    },
    [activeRoomId, client, currentUserDisplayName, currentUserId, t],
  );
  const locale = React.useMemo(() => getLocaleFromPath(pathname), [pathname]);
  const callSpaceSlug = React.useMemo(
    () => readCallSpaceSlug(pinnedCallSpaceSlug, activeSpaceSlug, activeRoomId),
    [activeRoomId, activeSpaceSlug, pinnedCallSpaceSlug],
  );
  const callSpaceHref = callSpaceSlug
    ? `/${locale}/dho/${callSpaceSlug}/coherence`
    : null;

  const onOpenCallSpace = React.useCallback(async () => {
    if (!callSpaceSlug || !activeRoomId?.trim()) return;

    if (isDocumentPipOpen) {
      closePip();
    }
    window.focus();

    const normalizedPath = (pathname.split('?')[0] ?? '').replace(/\/$/, '');
    const signalTarget = await resolveSignalThreadByMatrixRoom(
      activeRoomId.trim(),
    );
    const spaceSlug = signalTarget?.spaceSlug ?? callSpaceSlug;
    const destinationHref = `/${locale}/dho/${spaceSlug}/coherence`.replace(
      /\/$/,
      '',
    );

    if (signalTarget) {
      openCoherenceChat(
        signalTarget.roomId,
        signalTarget.signalTitle,
        signalTarget.signalSlug,
      );
    }

    openHumanChatPanel();

    if (normalizedPath !== destinationHref) {
      router.push(destinationHref);
    }
  }, [
    activeRoomId,
    callSpaceSlug,
    closePip,
    isDocumentPipOpen,
    locale,
    openCoherenceChat,
    openHumanChatPanel,
    pathname,
    router,
  ]);

  if (!showFloatingDock || !activeRoomId) return null;

  const captureUploadFinalizing =
    recordingStatus === 'uploading' &&
    callState !== 'connected' &&
    callState !== 'connecting' &&
    callState !== 'awaiting_media' &&
    callState !== 'initializing';
  const inDocumentPip = Boolean(pipWindow);
  const dockCompact = inDocumentPip;
  const modeIsFullscreen = dockMode === 'fullscreen' && !inDocumentPip;
  const containerStyle: React.CSSProperties = inDocumentPip
    ? { width: '100%', height: '100%' }
    : modeIsFullscreen
    ? {
        left: 16,
        right: 16,
        top: 72,
        bottom: 16,
      }
    : {
        width: geometry.width,
        height: geometry.height,
        right: 16,
        bottom: 16,
        transform: `translate(${geometry.x}px, ${geometry.y}px)`,
      };

  const onToggleMic = () => {
    void setMicrophoneMuted(!isMicrophoneMuted);
  };

  const onToggleCamera = () => {
    void setCameraMuted(!isLocalVideoMuted);
  };

  const onToggleScreenshare = () => {
    void setScreensharingEnabled(!isScreensharing);
  };
  const onVoiceProcessingPresetChange = (
    preset: 'standard' | 'voice_isolation' | 'music',
  ) => {
    void setVoiceProcessingPreset(preset);
  };
  const onCapturePreferenceChange = (
    mode: Exclude<SpaceGroupCallCaptureMode, 'none'>,
  ) => {
    setCapturePreference(mode);
  };
  const onStartCaptureWithMode = (
    mode?: Exclude<SpaceGroupCallCaptureMode, 'none'>,
  ) => {
    startCapture(mode);
  };
  const onPauseCapture = () => {
    pauseCapture();
  };
  const onResumeCapture = () => {
    resumeCapture();
  };
  const onStopCapture = () => {
    stopCapture();
  };
  const showDockBanner =
    errorCode != null || screenshareErrorCode != null || remoteMediaStall;

  const dockContent = (
    <div
      ref={dockRef}
      data-testid="global-call-dock"
      className={cn(
        inDocumentPip
          ? 'relative flex h-full w-full min-h-0 min-w-0 select-none flex-col overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-lg'
          : 'fixed z-[130] flex min-h-[320px] min-w-[480px] select-none flex-col overflow-visible rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-sm',
        modeIsFullscreen ? 'rounded-2xl' : '',
      )}
      style={{ ...spaceAccentStyles, ...containerStyle }}
    >
      {!modeIsFullscreen && !inDocumentPip && (
        <>
          <DockResizeHandle
            handle="top-left"
            ariaLabel={t('resizeTopLeftLabel')}
            onResizeStart={onResizeStart}
          />
          <DockResizeHandle
            handle="top"
            ariaLabel={t('resizeTopLabel')}
            onResizeStart={onResizeStart}
          />
          <DockResizeHandle
            handle="top-right"
            ariaLabel={t('resizeTopRightLabel')}
            onResizeStart={onResizeStart}
          />
          <DockResizeHandle
            handle="right"
            ariaLabel={t('resizeRightLabel')}
            onResizeStart={onResizeStart}
          />
          <DockResizeHandle
            handle="bottom"
            ariaLabel={t('resizeBottomLabel')}
            onResizeStart={onResizeStart}
          />
          <DockResizeHandle
            handle="left"
            ariaLabel={t('resizeLeftLabel')}
            onResizeStart={onResizeStart}
          />
        </>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
        <div
          className={cn(
            'flex shrink-0 items-center gap-1 border-b border-border/50 bg-muted/45',
            dockCompact ? 'px-1.5 py-1' : 'px-2.5 py-2',
            modeIsFullscreen || inDocumentPip
              ? 'cursor-default'
              : 'cursor-grab active:cursor-grabbing',
          )}
          onPointerDown={onDragStart}
        >
          <p
            className={cn(
              'min-w-0 flex-1 truncate font-medium text-foreground',
              dockCompact ? 'text-[11px]' : 'text-xs',
            )}
          >
            {t('callTitle', { count: roomGroupCallDeviceCount })}
          </p>
          {callSpaceHref && (
            <button
              type="button"
              data-no-dock-drag
              onClick={() => {
                void onOpenCallSpace();
              }}
              className={cn(
                'inline-flex items-center rounded-md border border-border/60 bg-background hover:bg-muted',
                dockCompact
                  ? 'h-6 justify-center gap-0.5 px-1.5 text-[10px]'
                  : 'h-7 gap-1 px-2 text-xs',
              )}
              aria-label={t('openSpaceLabel')}
              title={t('openSpaceLabel')}
            >
              <ArrowUpRight
                className={dockCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}
              />
              {t('spaceButton')}
            </button>
          )}
          {isScreensharing && roomGroupCallDeviceCount > 1 && !dockCompact ? (
            <HumanChatPanelCallFullViewLayoutMenu
              value={layoutMode}
              onValueChange={onShareLayoutModeChange}
              className="shrink-0"
            />
          ) : null}
          <div
            className={cn(
              'flex items-center',
              dockCompact ? 'gap-0.5' : 'gap-1',
            )}
          >
            {isDocumentPipSupported && (
              <button
                type="button"
                data-no-dock-drag
                onClick={() => {
                  void onToggleDocumentPip();
                }}
                className={cn(
                  'inline-flex items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted',
                  dockCompact ? 'h-6 w-6' : 'h-7 w-7',
                  isDocumentPipOpen && 'border-primary/50 bg-primary/10',
                )}
                aria-label={
                  isDocumentPipOpen
                    ? t('closeFloatingWindowLabel')
                    : t('openFloatingWindowLabel')
                }
                title={
                  isDocumentPipOpen
                    ? t('closeFloatingWindowLabel')
                    : t('openFloatingWindowLabel')
                }
              >
                <PictureInPicture2
                  className={dockCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                />
              </button>
            )}
            {!dockCompact && dockMode !== 'thumbnail' && (
              <button
                type="button"
                data-no-dock-drag
                onClick={() => applyDockMode('thumbnail')}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
                aria-label={t('minimizeLabel')}
                title={t('minimizeLabel')}
              >
                <Shrink className="h-3.5 w-3.5" />
              </button>
            )}
            {!dockCompact && !modeIsFullscreen && dockMode !== 'expanded' && (
              <button
                type="button"
                data-no-dock-drag
                onClick={() => applyDockMode('expanded')}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
                aria-label={t('expandLabel')}
                title={t('expandLabel')}
              >
                <Expand className="h-3.5 w-3.5" />
              </button>
            )}
            {!dockCompact && (
              <button
                type="button"
                data-no-dock-drag
                onClick={onToggleFullscreen}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
                aria-label={
                  modeIsFullscreen
                    ? t('exitFullscreenLabel')
                    : t('fullscreenLabel')
                }
                title={
                  modeIsFullscreen
                    ? t('exitFullscreenLabel')
                    : t('fullscreenLabel')
                }
              >
                {modeIsFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        <div
          ref={splitContainerRef}
          className={cn(
            'min-h-0 min-w-0',
            inDocumentPip ? 'max-h-[72px] shrink-0' : 'flex-1',
          )}
        >
          {captureUploadFinalizing ? (
            <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {tCapture('callCaptureStatusSaving')}
              </p>
            </div>
          ) : (
            <HumanChatPanelCallStage
              client={client}
              roomId={activeRoomId}
              groupCall={groupCall}
              callKind={callKind}
              isLocalVideoMuted={isLocalVideoMuted}
              isMicrophoneMuted={isMicrophoneMuted}
              isScreensharing={isScreensharing}
              callState={callState}
              feedVersion={feedVersion}
              activeSpeakerKey={activeSpeakerKey}
              currentUserId={currentUserId}
              inCallUserIds={inCallUserIdsForRoster}
              remoteMediaStall={remoteMediaStall}
              currentUserProfileAvatarUrl={me?.avatarUrl ?? null}
              resolveMemberLabel={resolveMemberLabel}
              layout={modeIsFullscreen ? 'fullView' : 'panel'}
              panelVideoFit={
                !modeIsFullscreen && dockMode === 'thumbnail'
                  ? 'contain'
                  : 'cover'
              }
              panelFlush={!modeIsFullscreen}
              fullViewOpen={modeIsFullscreen}
              fullViewLayoutMode={layoutMode}
              fullViewPaneSplit={paneSplit}
              onFullViewPaneSplitChange={onPaneSplitChange}
              fullViewSplitContainerRef={splitContainerRef}
            />
          )}
        </div>

        <div
          className={cn(
            'relative z-10 shrink-0 overflow-visible border-t border-border/50 bg-muted/35',
            dockCompact ? 'px-1 py-1' : 'px-2 py-2',
          )}
        >
          {captureUploadFinalizing ? (
            recordingError?.trim() ? (
              <p className="text-[11px] text-destructive">{recordingError}</p>
            ) : null
          ) : (
            <>
              {captureConsent &&
              callState === 'connected' &&
              !showDockBanner ? (
                <HumanChatPanelCaptureConsentBanner
                  consent={captureConsent}
                  roomId={activeRoomId}
                  variant="inCall"
                  className={cn(
                    'rounded-none border-x-0 border-t-0',
                    dockCompact
                      ? '-mx-1 -mt-1 mb-1 px-2 py-1 [&_p]:text-[10px] [&_p]:leading-tight'
                      : '-mx-2 -mt-2 mb-2',
                  )}
                />
              ) : null}
              {showDockBanner ? (
                <HumanChatPanelCallBanner
                  callState={callState}
                  callKind={callKind}
                  errorCode={errorCode}
                  isScreensharing={isScreensharing}
                  screenshareErrorCode={screenshareErrorCode}
                  tabBackgroundWhileInCall={tabBackgroundWhileInCall}
                  isMicrophoneMuted={isMicrophoneMuted}
                  isLocalVideoMuted={isLocalVideoMuted}
                  participantCount={roomGroupCallDeviceCount}
                  othersInRoomCallCount={othersInRoomCallCount}
                  remoteMediaStall={remoteMediaStall}
                  onDismissRemoteMediaStall={dismissRemoteMediaStallBanner}
                  onLeave={() => {
                    void leave();
                  }}
                  onToggleMic={onToggleMic}
                  onToggleCamera={onToggleCamera}
                  onToggleScreenshare={onToggleScreenshare}
                  voiceProcessingPreset={voiceProcessingPreset}
                  onVoiceProcessingPresetChange={onVoiceProcessingPresetChange}
                  captureMode={captureMode}
                  capturePreference={capturePreference}
                  capturePreferenceSelected={capturePreferenceSelected}
                  onCapturePreferenceChange={onCapturePreferenceChange}
                  onStartCapture={onStartCaptureWithMode}
                  onPauseCapture={onPauseCapture}
                  onResumeCapture={onResumeCapture}
                  onStopCapture={onStopCapture}
                  recordingStatus={recordingStatus}
                  recordingError={recordingError}
                  recordingWarning={recordingWarning}
                  canRetryRecordingUpload={canRetryRecordingUpload}
                  onRetryRecordingUpload={() => void retryRecordingUpload()}
                  captureConsent={captureConsent}
                  roomId={activeRoomId}
                  onDismissScreenshareError={dismissScreenshareError}
                  onRetryCall={retryFromError}
                  onDismissCallError={dismissCallError}
                />
              ) : (
                <HumanChatPanelInCallControls
                  callState={callState}
                  isMicrophoneMuted={isMicrophoneMuted}
                  isLocalVideoMuted={isLocalVideoMuted}
                  isScreensharing={isScreensharing}
                  onToggleMic={onToggleMic}
                  onToggleCamera={onToggleCamera}
                  onToggleScreenshare={onToggleScreenshare}
                  voiceProcessingPreset={voiceProcessingPreset}
                  onVoiceProcessingPresetChange={onVoiceProcessingPresetChange}
                  captureMode={captureMode}
                  capturePreference={capturePreference}
                  capturePreferenceSelected={capturePreferenceSelected}
                  onCapturePreferenceChange={onCapturePreferenceChange}
                  onStartCapture={onStartCaptureWithMode}
                  onPauseCapture={onPauseCapture}
                  onResumeCapture={onResumeCapture}
                  onStopCapture={onStopCapture}
                  recordingStatus={recordingStatus}
                  recordingError={recordingError}
                  recordingWarning={recordingWarning}
                  canRetryRecordingUpload={canRetryRecordingUpload}
                  onRetryRecordingUpload={() => void retryRecordingUpload()}
                  onLeave={() => {
                    void leave();
                  }}
                  density={dockCompact ? 'compact' : 'default'}
                  variant={modeIsFullscreen ? 'fullView' : 'inBanner'}
                  inBannerLayout={
                    dockCompact
                      ? 'inline'
                      : modeIsFullscreen
                      ? 'inline'
                      : 'centered'
                  }
                />
              )}
            </>
          )}
        </div>
      </div>

      {modeIsFullscreen && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5" />
      )}

      <HumanChatPanelScreenshareTakeoverDialog
        incoming={screenshareTakeoverIncoming}
        pending={Boolean(screenshareTakeoverPendingId)}
        denied={screenshareTakeoverDenied}
        onApprove={(request) => {
          void approveScreenshareTakeover(request);
        }}
        onDeny={(request) => {
          void denyScreenshareTakeover(request);
        }}
        onCancelPending={() => {
          void cancelScreenshareTakeoverRequest();
        }}
        onDismissDenied={dismissScreenshareTakeoverPrompt}
      />
    </div>
  );

  if (pipWindow) {
    return createPortal(dockContent, pipWindow.document.body);
  }

  return dockContent;
}
