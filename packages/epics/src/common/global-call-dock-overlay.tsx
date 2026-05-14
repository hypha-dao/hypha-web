'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Maximize2,
  Minimize2,
  PictureInPicture2,
  PanelBottomOpen,
  ArrowUpRight,
} from 'lucide-react';
import { useMatrix, useMe } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter } from 'next/navigation';
import {
  DEFAULT_CALL_FULL_VIEW_LAYOUT,
  HumanChatPanelCallStage,
  HumanChatPanelInCallControls,
  readCallFullViewLayoutFromStorage,
  persistCallFullViewLayout,
  type CallFullViewLayoutMode,
  type CallFullViewPaneSplit,
  readCallFullViewPaneSplit,
  persistCallFullViewPaneSplit,
} from './human-chat-panel';
import { matrixMemberDisplayLabelFromRoom } from './human-chat-panel/matrix-room-member-display';
import { useGlobalCallDock } from './global-call-dock-context';
import { getLocaleFromPath } from './get-locale-from-path';

type DockGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DOCK_GEOMETRY_KEY = 'hypha-global-call-dock-geometry-v1';
const DOCK_MARGIN_PX = 16;
const SNAP_EDGE_PX = 24;
const DOCK_MIN_WIDTH = 320;
const DOCK_MIN_HEIGHT = 220;
const THUMBNAIL_GEOMETRY: Pick<DockGeometry, 'width' | 'height'> = {
  width: 380,
  height: 300,
};
const EXPANDED_GEOMETRY: Pick<DockGeometry, 'width' | 'height'> = {
  width: 720,
  height: 460,
};

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
  const width = Math.max(DOCK_MIN_WIDTH, next.width);
  const height = Math.max(DOCK_MIN_HEIGHT, next.height);
  const bounds = getDockOffsetBounds(width, height);
  return {
    width,
    height,
    x: Math.min(Math.max(next.x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(next.y, bounds.minY), bounds.maxY),
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
    return { x: 0, y: 0, width: 360, height: 240 };
  }
  try {
    const raw = window.localStorage.getItem(DOCK_GEOMETRY_KEY);
    if (!raw) return { x: 0, y: 0, width: 360, height: 240 };
    const parsed = JSON.parse(raw) as Partial<DockGeometry>;
    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : 0,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : 0,
      width: Number.isFinite(parsed.width) ? Number(parsed.width) : 360,
      height: Number.isFinite(parsed.height) ? Number(parsed.height) : 240,
    };
  } catch {
    return { x: 0, y: 0, width: 360, height: 240 };
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
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { client } = useMatrix();
  const { person: me } = useMe();
  const {
    activeRoomId,
    activeSpaceSlug,
    showFloatingDock,
    dockMode,
    setDockMode,
    callState,
    callKind,
    isLocalVideoMuted,
    isScreensharing,
    feedVersion,
    activeSpeakerKey,
    inCallUserIdsForRoster,
    remoteMediaStall,
    groupCall,
    roomGroupCallDeviceCount,
    isMicrophoneMuted,
    setMicrophoneMuted,
    setCameraMuted,
    setScreensharingEnabled,
    leave,
  } = useGlobalCallDock();

  const [layoutMode, setLayoutMode] = React.useState<CallFullViewLayoutMode>(
    DEFAULT_CALL_FULL_VIEW_LAYOUT,
  );
  const [paneSplit, setPaneSplit] = React.useState<{
    sideBySide: number;
    filmstrip: number;
    speakerOnTop: number;
  }>(() => ({
    sideBySide: readCallFullViewPaneSplit('sideBySide'),
    filmstrip: readCallFullViewPaneSplit('filmstrip'),
    speakerOnTop: readCallFullViewPaneSplit('speakerOnTop'),
  }));
  const [geometry, setGeometry] = React.useState<DockGeometry>(() =>
    clampDockGeometry(readDockGeometry()),
  );
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const dockRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    setLayoutMode(readCallFullViewLayoutFromStorage());
  }, []);

  const onPaneSplitChange = React.useCallback(
    (which: CallFullViewPaneSplit, value: number) => {
      persistCallFullViewPaneSplit(which, value);
      setPaneSplit((prev) => ({ ...prev, [which]: value }));
    },
    [],
  );

  React.useEffect(() => {
    persistDockGeometry(clampDockGeometry(geometry));
  }, [geometry]);

  React.useEffect(() => {
    const el = dockRef.current;
    if (!el || dockMode === 'fullscreen') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      setGeometry((prev) =>
        clampDockGeometry({
          ...prev,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }),
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [dockMode]);

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
    const preset =
      dockMode === 'thumbnail' ? THUMBNAIL_GEOMETRY : EXPANDED_GEOMETRY;
    setGeometry((prev) =>
      clampDockGeometry({
        ...prev,
        width: Math.max(prev.width, preset.width),
        height: Math.max(prev.height, preset.height),
      }),
    );
  }, [dockMode]);

  React.useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      setGeometry((prev) =>
        clampDockGeometry({
          ...prev,
          x: drag.startOffsetX + (e.clientX - drag.startX),
          y: drag.startOffsetY + (e.clientY - drag.startY),
        }),
      );
    };

    const onEnd = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
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
  }, [isDragging]);

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

  const resolveMemberLabel = React.useCallback(
    (userId: string | undefined) => {
      if (!userId?.trim()) return t('unknownMember');
      return matrixMemberDisplayLabelFromRoom(client, activeRoomId, userId);
    },
    [client, activeRoomId, t],
  );

  const currentUserId = client?.getUserId?.() ?? null;
  const locale = React.useMemo(() => getLocaleFromPath(pathname), [pathname]);
  const callSpaceHref = activeSpaceSlug
    ? `/${locale}/dho/${activeSpaceSlug}`
    : null;

  if (!showFloatingDock || !activeRoomId) return null;

  const modeIsFullscreen = dockMode === 'fullscreen';
  const containerStyle: React.CSSProperties = modeIsFullscreen
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
        resize: 'both',
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

  return (
    <div
      ref={dockRef}
      className={cn(
        'fixed z-[130] flex min-h-[180px] min-w-[280px] flex-col overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-sm',
        modeIsFullscreen ? 'rounded-2xl' : '',
      )}
      style={containerStyle}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-border/50 bg-muted/45 px-2.5 py-2',
          modeIsFullscreen
            ? 'cursor-default'
            : 'cursor-grab active:cursor-grabbing',
        )}
        onPointerDown={onDragStart}
      >
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {t('callTitle', { count: roomGroupCallDeviceCount })}
        </p>
        {callSpaceHref && (
          <button
            type="button"
            data-no-dock-drag
            onClick={() => router.push(callSpaceHref)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-xs hover:bg-muted"
            aria-label={t('openSpaceLabel')}
            title={t('openSpaceLabel')}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t('spaceButton')}
          </button>
        )}
        <div className="flex items-center gap-1">
          {dockMode !== 'thumbnail' && (
            <button
              type="button"
              data-no-dock-drag
              onClick={() => setDockMode('thumbnail')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
              aria-label={t('minimizeLabel')}
              title={t('minimizeLabel')}
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>
          )}
          {dockMode !== 'expanded' && !modeIsFullscreen && (
            <button
              type="button"
              data-no-dock-drag
              onClick={() => setDockMode('expanded')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
              aria-label={t('expandLabel')}
              title={t('expandLabel')}
            >
              <PanelBottomOpen className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            data-no-dock-drag
            onClick={() =>
              setDockMode(modeIsFullscreen ? 'expanded' : 'fullscreen')
            }
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
            aria-label={
              modeIsFullscreen ? t('exitFullscreenLabel') : t('fullscreenLabel')
            }
            title={
              modeIsFullscreen ? t('exitFullscreenLabel') : t('fullscreenLabel')
            }
          >
            {modeIsFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div ref={splitContainerRef} className="min-h-0 min-w-0 flex-1">
        <HumanChatPanelCallStage
          client={client}
          roomId={activeRoomId}
          groupCall={groupCall}
          callKind={callKind}
          isLocalVideoMuted={isLocalVideoMuted}
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
          panelVideoFit={dockMode === 'thumbnail' ? 'contain' : 'cover'}
          fullViewOpen={modeIsFullscreen}
          fullViewLayoutMode={layoutMode}
          fullViewPaneSplit={paneSplit}
          onFullViewPaneSplitChange={onPaneSplitChange}
          fullViewSplitContainerRef={splitContainerRef}
        />
      </div>

      <div className="shrink-0 border-t border-border/50 bg-muted/35 px-2 py-2">
        <HumanChatPanelInCallControls
          callState={callState}
          isMicrophoneMuted={isMicrophoneMuted}
          isLocalVideoMuted={isLocalVideoMuted}
          isScreensharing={isScreensharing}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onToggleScreenshare={onToggleScreenshare}
          onLeave={() => {
            void leave();
          }}
          variant={modeIsFullscreen ? 'fullView' : 'inBanner'}
        />
      </div>

      {modeIsFullscreen && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5" />
      )}
    </div>
  );
}
