'use client';

import * as React from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { cn } from '@hypha-platform/ui-utils';
import { Loader2 } from 'lucide-react';
import { NetworkMapLayerControls } from './network-map-layer-controls';
import type {
  NetworkGlobeMapProps,
  NetworkMapLayerVisibility,
  NetworkMapProjectionMode,
} from '../lib/types';
import { hasSpaceMapLocation } from '@hypha-platform/core/client';
import { loadLandGeo } from '../lib/load-land-geo';
import {
  cartesian,
  delta,
  fromAngles,
  interpolateAngles,
  multiply,
  toAngles,
  type Rotation,
} from '../lib/versor';
import {
  clampHoverPosition,
  NetworkMapPinHoverCard,
} from './network-map-pin-hover-card';
import { useInitialGlobeCenter } from '../hooks/use-initial-globe-center';
import {
  DEFAULT_GLOBE_ROTATION,
  globeRotationForCenter,
} from '../lib/globe-rotation';
import { setNetworkGlobeReady } from '../lib/network-globe-ready-store';
const PROJECTION_ANIMATION_MS = 1200;
const FLAT_ROTATION: Rotation = [0, 0, 0];

type MapPalette = {
  ocean: string;
  landFill: string;
  landStroke: string;
  grid: string;
  sphereShadow: string | null;
};

/** Pinned dark-mode globe colors — pale ocean + dark land on black page background. */
const DARK_GLOBE_PALETTE: MapPalette = {
  ocean: 'oklch(90.334% 0.04675 220.665)',
  landFill: 'oklch(34.655% 0.01033 254.043)',
  landStroke: 'oklch(53.701% 0.01538 262.385)',
  grid: 'oklch(48.932% 0.01557 251.766)',
  sphereShadow: null,
};

function mapPaletteForTheme(theme: string | undefined): MapPalette {
  if (theme === 'light') {
    return {
      ocean: 'var(--info-5)',
      landFill: 'var(--neutral-7)',
      landStroke: 'var(--neutral-9)',
      grid: 'var(--neutral-8)',
      sphereShadow:
        'drop-shadow(0 10px 28px color-mix(in oklab, var(--info-9) 18%, transparent))',
    };
  }

  return DARK_GLOBE_PALETTE;
}

function pinColor(id: number): string {
  const hue = Math.abs((id * 47) % 360);
  return `hsl(${hue} 68% 58%)`;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function effectiveRotation(morph: number, rotate: Rotation): Rotation {
  return morph >= 1 ? FLAT_ROTATION : rotate;
}

/** Orthographic projects back-hemisphere points onto the visible disk — hide those. */
function isPinVisibleOnProjection(
  projection: d3.GeoProjection,
  longitude: number,
  latitude: number,
): boolean {
  const clipAngle = projection.clipAngle?.();
  if (clipAngle == null || clipAngle >= 180) {
    return true;
  }

  const rotate = projection.rotate();
  const center: [number, number] = [-rotate[0], -rotate[1]];
  return d3.geoDistance([longitude, latitude], center) <= Math.PI / 2 + 1e-9;
}

function parsePinTransform(element: Element): { x: number; y: number } | null {
  const transform = element.getAttribute('transform');
  if (!transform) {
    return null;
  }
  const match = /translate\(([-\d.]+),([-\d.]+)\)/.exec(transform);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const x = Number.parseFloat(match[1]);
  const y = Number.parseFloat(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

function canUseHover(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function buildProjection(
  width: number,
  height: number,
  morph: number,
  rotate: Rotation,
): d3.GeoProjection {
  const rotation = effectiveRotation(morph, rotate);
  const minDim = Math.min(width, height);
  const globeScale = minDim / 2 - 24;
  const flatScale = width / (2 * Math.PI);
  const center: [number, number] = [width / 2, height / 2];

  if (morph <= 0) {
    return d3
      .geoOrthographic()
      .scale(globeScale)
      .translate(center)
      .rotate(rotation)
      .clipAngle(90);
  }

  if (morph >= 1) {
    return d3
      .geoEquirectangular()
      .scale(flatScale)
      .translate(center)
      .rotate(rotation);
  }

  const scale = globeScale * (1 - morph) + flatScale * morph;
  if (morph < 0.5) {
    return d3
      .geoOrthographic()
      .scale(scale)
      .translate(center)
      .rotate(rotation)
      .clipAngle(90 - morph * 45);
  }

  return d3
    .geoEquirectangular()
    .scale(scale)
    .translate(center)
    .rotate(rotation);
}

export function NetworkGlobeMap({
  lang,
  spaces,
  className,
  renderToolbar,
  isActive = true,
}: NetworkGlobeMapProps) {
  const t = useTranslations('NetworkMap');
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const initialCenter = useInitialGlobeCenter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const mapPalette = React.useMemo(
    () => mapPaletteForTheme(resolvedTheme),
    [resolvedTheme],
  );
  const mapPaletteRef = React.useRef(mapPalette);
  mapPaletteRef.current = mapPalette;

  const locatedSpaces = React.useMemo(
    () => spaces.filter(hasSpaceMapLocation),
    [spaces],
  );

  const [hoveredPin, setHoveredPin] = React.useState<{
    spaceId: number;
    x: number;
    y: number;
  } | null>(null);
  const [selectedPin, setSelectedPin] = React.useState<{
    spaceId: number;
    x: number;
    y: number;
  } | null>(null);
  const setHoveredPinRef = React.useRef(setHoveredPin);
  setHoveredPinRef.current = setHoveredPin;
  const setSelectedPinRef = React.useRef(setSelectedPin);
  setSelectedPinRef.current = setSelectedPin;
  const canHoverRef = React.useRef(canUseHover());

  const [layers, setLayers] = React.useState<NetworkMapLayerVisibility>({
    land: true,
    water: true,
    grid: false,
  });
  const [projectionMode, setProjectionMode] =
    React.useState<NetworkMapProjectionMode>('globe');
  const [selectedProjection, setSelectedProjection] =
    React.useState<NetworkMapProjectionMode>('globe');
  const [morphProgress, setMorphProgress] = React.useState(0);
  const [isLoadingGeo, setIsLoadingGeo] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const landRef = React.useRef<d3.GeoPermissibleObjects | null>(null);
  const rotateRef = React.useRef<Rotation>(DEFAULT_GLOBE_ROTATION);
  const savedGlobeRotateRef = React.useRef<Rotation>(DEFAULT_GLOBE_ROTATION);
  const morphRef = React.useRef(morphProgress);
  const layersRef = React.useRef(layers);
  const locatedSpacesRef = React.useRef(locatedSpaces);
  const dragV0Ref = React.useRef<[number, number, number] | null>(null);
  const dragR0Ref = React.useRef<Rotation>(DEFAULT_GLOBE_ROTATION);
  const dragQ0Ref = React.useRef<ReturnType<typeof fromAngles> | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const renderFrameRef = React.useRef<number | null>(null);
  const isDraggingRef = React.useRef(false);
  const hasUserRotatedRef = React.useRef(false);
  const renderMapRef = React.useRef<() => void>(() => {});

  morphRef.current = morphProgress;
  layersRef.current = layers;
  locatedSpacesRef.current = locatedSpaces;

  const updateHoveredPin = React.useCallback(
    (spaceId: number, event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      setHoveredPinRef.current({
        spaceId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [],
  );

  const clearHoveredPin = React.useCallback(() => {
    setHoveredPinRef.current(null);
  }, []);

  const clearSelectedPin = React.useCallback(() => {
    setSelectedPinRef.current(null);
  }, []);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const syncCanHover = () => {
      canHoverRef.current = mediaQuery.matches;
      if (mediaQuery.matches) {
        clearSelectedPin();
      } else {
        clearHoveredPin();
      }
    };
    syncCanHover();
    mediaQuery.addEventListener('change', syncCanHover);
    return () => mediaQuery.removeEventListener('change', syncCanHover);
  }, [clearHoveredPin, clearSelectedPin]);

  const updateHoveredPinRef = React.useRef(updateHoveredPin);
  const clearHoveredPinRef = React.useRef(clearHoveredPin);
  const clearSelectedPinRef = React.useRef(clearSelectedPin);
  updateHoveredPinRef.current = updateHoveredPin;
  clearHoveredPinRef.current = clearHoveredPin;
  clearSelectedPinRef.current = clearSelectedPin;

  const renderMap = React.useCallback(() => {
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const land = landRef.current;
    if (!container || !land) {
      return;
    }

    const width = container.clientWidth;
    const height = Math.max(360, Math.min(560, width * 0.62));
    if (width <= 0) {
      return;
    }

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const morph = morphRef.current;
    const rotate = rotateRef.current;
    const projection = buildProjection(width, height, morph, rotate);
    const path = d3.geoPath(projection);
    const layerState = layersRef.current;
    const palette = mapPaletteRef.current;
    const isGlobeView = morph < 1;

    let root = svg.select<SVGGElement>('g.map-root');
    if (root.empty()) {
      root = svg.append('g').attr('class', 'map-root');
      root.append('path').attr('class', 'map-ocean');
      root.append('path').attr('class', 'map-grid');
      root.append('path').attr('class', 'map-land');
      root.append('g').attr('class', 'map-pins');
    }

    root.style(
      'filter',
      isGlobeView && palette.sphereShadow ? palette.sphereShadow : 'none',
    );

    const ocean = root.select<SVGPathElement>('path.map-ocean');
    if (layerState.water) {
      ocean
        .attr('d', path({ type: 'Sphere' }) ?? '')
        .attr('fill', palette.ocean)
        .attr('stroke', 'none')
        .style('display', null);
    } else {
      ocean.attr('d', null).style('display', 'none');
    }

    const gridPath = root.select<SVGPathElement>('path.map-grid');
    if (layerState.grid) {
      gridPath
        .attr('d', path(d3.geoGraticule10()) ?? '')
        .attr('fill', 'none')
        .attr('stroke', palette.grid)
        .attr('stroke-width', 0.4)
        .attr('opacity', 0.45)
        .style('display', null);
    } else {
      gridPath.attr('d', null).style('display', 'none');
    }

    const landPath = root.select<SVGPathElement>('path.map-land');
    if (layerState.land) {
      landPath
        .attr('d', path(land) ?? '')
        .attr('fill', palette.landFill)
        .attr('stroke', palette.landStroke)
        .attr('stroke-width', 0.5)
        .style('display', null);
    } else {
      landPath.attr('d', null).style('display', 'none');
    }

    const pinGroup = root.select<SVGGElement>('g.map-pins');
    const pins = pinGroup
      .selectAll<SVGGElement, (typeof locatedSpacesRef.current)[number]>(
        'g.map-pin',
      )
      .data(locatedSpacesRef.current, (space) => space.id);

    pins.exit().remove();

    const pinsEnter = pins
      .enter()
      .append('g')
      .attr('class', 'map-pin')
      .attr('cursor', 'pointer')
      .attr('tabindex', 0)
      .attr('role', 'link')
      .on('click', function (event: MouseEvent, space) {
        event.stopPropagation();
        if (isDraggingRef.current) {
          return;
        }
        if (canHoverRef.current) {
          router.push(`/${lang}/dho/${space.slug}/agreements`);
          return;
        }
        const position = parsePinTransform(this);
        if (!position) {
          return;
        }
        setSelectedPinRef.current((current) =>
          current?.spaceId === space.id
            ? null
            : { spaceId: space.id, ...position },
        );
      })
      .on('keydown', (event: KeyboardEvent, space) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(`/${lang}/dho/${space.slug}/agreements`);
        }
      })
      .on('mouseenter', function (event: MouseEvent, space) {
        if (!canHoverRef.current || isDraggingRef.current) {
          return;
        }
        updateHoveredPinRef.current(space.id, event);
      })
      .on('mousemove', function (event: MouseEvent, space) {
        if (!canHoverRef.current || isDraggingRef.current) {
          return;
        }
        updateHoveredPinRef.current(space.id, event);
      })
      .on('mouseleave', () => {
        if (!canHoverRef.current || isDraggingRef.current) {
          return;
        }
        clearHoveredPinRef.current();
      });

    pinsEnter
      .append('circle')
      .attr('r', 12)
      .attr('fill', 'transparent')
      .attr('pointer-events', 'all');

    pinsEnter
      .append('circle')
      .attr('r', 5)
      .attr('fill', (space) => pinColor(space.id))
      .attr('stroke', 'white')
      .attr('stroke-width', 1.5)
      .attr('pointer-events', 'none');

    pinsEnter
      .append('title')
      .text((space) => space.locationLabel ?? space.title);

    pins.merge(pinsEnter).each(function (space) {
      const latitude = space.latitude;
      const longitude = space.longitude;
      if (latitude == null || longitude == null) {
        d3.select(this).style('display', 'none');
        return;
      }

      const projected = projection([longitude, latitude]);
      if (!projected) {
        d3.select(this).style('display', 'none');
        return;
      }

      if (!isPinVisibleOnProjection(projection, longitude, latitude)) {
        d3.select(this).style('display', 'none');
        return;
      }

      const [x, y] = projected;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        d3.select(this).style('display', 'none');
        return;
      }

      d3.select(this)
        .attr('transform', `translate(${x},${y})`)
        .style('display', null);
    });
  }, [lang, router]);

  renderMapRef.current = renderMap;

  const isActiveRef = React.useRef(isActive);
  isActiveRef.current = isActive;

  const requestRender = React.useCallback(() => {
    if (!isActiveRef.current) {
      return;
    }
    if (renderFrameRef.current != null) {
      return;
    }
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      renderMapRef.current();
    });
  }, []);

  const scheduleRender = React.useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestRender();
      });
    });
  }, [requestRender]);

  React.useEffect(() => {
    if (hasUserRotatedRef.current || morphRef.current >= 1) {
      return;
    }

    const rotation = globeRotationForCenter(
      initialCenter.longitude,
      initialCenter.latitude,
    );
    rotateRef.current = rotation;
    savedGlobeRotateRef.current = rotation;
    requestRender();
  }, [initialCenter.latitude, initialCenter.longitude, requestRender]);

  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    setNetworkGlobeReady(false);
    return () => setNetworkGlobeReady(false);
  }, [isActive]);

  React.useEffect(() => {
    if (!isActive || isLoadingGeo || loadError) {
      setNetworkGlobeReady(false);
      return;
    }

    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          setNetworkGlobeReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      setNetworkGlobeReady(false);
    };
  }, [isActive, isLoadingGeo, loadError]);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoadingGeo(true);
    setLoadError(null);

    loadLandGeo()
      .then((land) => {
        if (cancelled) {
          return;
        }
        landRef.current = land;
        setIsLoadingGeo(false);
        scheduleRender();
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(t('mapLoadError'));
        setIsLoadingGeo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scheduleRender, t]);

  React.useEffect(() => {
    if (!isActive || isLoadingGeo || loadError || !landRef.current) {
      return;
    }
    scheduleRender();
  }, [isActive, isLoadingGeo, loadError, scheduleRender]);

  React.useEffect(() => {
    renderMap();
  }, [
    layers,
    morphProgress,
    projectionMode,
    locatedSpaces,
    mapPalette,
    renderMap,
  ]);

  React.useEffect(() => {
    const container = containerRef.current;
    const svgElement = svgRef.current;
    if (!container || !svgElement || isLoadingGeo || loadError) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      requestRender();
    });
    resizeObserver.observe(container);

    function mapDimensions() {
      const width = container!.clientWidth;
      const height = Math.max(360, Math.min(560, width * 0.62));
      return { width, height };
    }

    function pointerFromEvent(
      event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>,
    ): [number, number] {
      return d3.pointer(event.sourceEvent, svgElement);
    }

    function globeProjectionAtRotation(rotate: Rotation) {
      const { width, height } = mapDimensions();
      return buildProjection(width, height, 0, rotate);
    }

    const dragBehavior = d3
      .drag<SVGSVGElement, unknown>()
      .filter((event) => {
        if (morphRef.current >= 0.01) {
          return false;
        }
        return !event.ctrlKey && !event.button;
      })
      .on('start', (event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) => {
        if (event.sourceEvent instanceof MouseEvent) {
          event.sourceEvent.preventDefault();
        }
        isDraggingRef.current = true;
        hasUserRotatedRef.current = true;
        clearHoveredPinRef.current();
        clearSelectedPinRef.current();

        const [x, y] = pointerFromEvent(event);
        const invert = globeProjectionAtRotation(rotateRef.current).invert?.([
          x,
          y,
        ]);
        if (!invert) {
          dragV0Ref.current = null;
          dragQ0Ref.current = null;
          return;
        }

        dragV0Ref.current = cartesian(invert);
        dragR0Ref.current = [...rotateRef.current];
        dragQ0Ref.current = fromAngles(rotateRef.current);
      })
      .on('drag', (event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) => {
        const v0 = dragV0Ref.current;
        const r0 = dragR0Ref.current;
        const q0 = dragQ0Ref.current;
        if (!v0 || !q0) {
          return;
        }

        const [x, y] = pointerFromEvent(event);
        const invert = globeProjectionAtRotation(r0).invert?.([x, y]);
        if (!invert) {
          return;
        }

        const v1 = cartesian(invert);
        const q1 = multiply(q0, delta(v0, v1));
        rotateRef.current = toAngles(q1);
        savedGlobeRotateRef.current = rotateRef.current;
        requestRender();
      })
      .on('end', () => {
        isDraggingRef.current = false;
        dragV0Ref.current = null;
        dragQ0Ref.current = null;
      });

    d3.select(svgElement).call(dragBehavior);

    return () => {
      resizeObserver.disconnect();
      d3.select(svgElement).on('.drag', null);
    };
  }, [isLoadingGeo, loadError, requestRender]);

  const animateProjection = React.useCallback(
    (target: NetworkMapProjectionMode) => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const fromMorph = morphRef.current;
      const toMorph = target === 'flat' ? 1 : 0;
      if (Math.abs(fromMorph - toMorph) < 1e-6) {
        return;
      }

      setSelectedProjection(target);

      const fromRotate = [...rotateRef.current] as Rotation;
      const toRotate: Rotation =
        target === 'flat'
          ? (() => {
              savedGlobeRotateRef.current = [...rotateRef.current] as Rotation;
              return FLAT_ROTATION;
            })()
          : savedGlobeRotateRef.current;
      const interpolateRotation = interpolateAngles(fromRotate, toRotate);

      if (prefersReducedMotion()) {
        morphRef.current = toMorph;
        rotateRef.current = toRotate;
        setMorphProgress(toMorph);
        setProjectionMode(target);
        requestRender();
        return;
      }

      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / PROJECTION_ANIMATION_MS);
        const eased = d3.easeCubicInOut(t);
        morphRef.current = fromMorph + (toMorph - fromMorph) * eased;
        rotateRef.current = interpolateRotation(eased);
        requestRender();
        if (t < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        } else {
          animationFrameRef.current = null;
          morphRef.current = toMorph;
          rotateRef.current = toRotate;
          setMorphProgress(toMorph);
          setProjectionMode(target);
          requestRender();
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);
    },
    [requestRender],
  );

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (renderFrameRef.current != null) {
        cancelAnimationFrame(renderFrameRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (canHoverRef.current) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        !target.closest('.map-pin') &&
        !target.closest('[data-network-map-hover-card]')
      ) {
        clearSelectedPinRef.current();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const activePin = hoveredPin ?? selectedPin;
  const activeSpace = activePin
    ? locatedSpaces.find((space) => space.id === activePin.spaceId)
    : null;

  const hoverCard =
    activeSpace && activePin ? (
      <NetworkMapPinHoverCard
        lang={lang}
        space={activeSpace}
        {...clampHoverPosition(
          activePin.x,
          activePin.y,
          containerRef.current?.clientWidth ?? 640,
          containerRef.current?.clientHeight ?? 360,
        )}
      />
    ) : null;

  const layerControls = (
    <NetworkMapLayerControls
      layers={layers}
      projectionMode={selectedProjection}
      onLayerChange={(layer, visible) =>
        setLayers((current) => ({ ...current, [layer]: visible }))
      }
      onProjectionModeChange={animateProjection}
    />
  );

  const toolbar = renderToolbar ? (
    renderToolbar(layerControls)
  ) : (
    <div className="flex justify-center">{layerControls}</div>
  );

  if (locatedSpaces.length === 0) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-4', className)}>
        {toolbar}
        <div
          ref={containerRef}
          className="relative min-h-[360px] w-full overflow-hidden"
        >
          {isLoadingGeo ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-neutral-11">
              <Loader2 className="size-5 animate-spin" />
              <span>{t('loadingMap')}</span>
            </div>
          ) : null}
          {loadError ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-3 text-neutral-11">
              {loadError}
            </div>
          ) : null}
          <svg
            ref={svgRef}
            className={cn(
              'block w-full touch-none select-none',
              projectionMode === 'globe'
                ? 'cursor-grab active:cursor-grabbing'
                : 'cursor-default',
              isLoadingGeo ? 'invisible' : undefined,
            )}
            role="img"
            aria-label={t('mapAriaLabel')}
          />
          {hoverCard}
        </div>
        <div className="px-0 py-2 text-center">
          <p className="text-4 text-neutral-11">{t('noSpacesWithLocation')}</p>
          <p className="text-2 text-neutral-10">
            {t('noSpacesWithLocationHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-4', className)}>
      {toolbar}
      <div
        ref={containerRef}
        className="relative min-h-[360px] w-full overflow-hidden"
      >
        {isLoadingGeo ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-neutral-11">
            <Loader2 className="size-5 animate-spin" />
            <span>{t('loadingMap')}</span>
          </div>
        ) : null}
        {loadError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-3 text-neutral-11">
            {loadError}
          </div>
        ) : null}
        <svg
          ref={svgRef}
          className={cn(
            'block w-full touch-none select-none',
            projectionMode === 'globe'
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-default',
            isLoadingGeo ? 'invisible' : undefined,
          )}
          role="img"
          aria-label={t('mapAriaLabel')}
        />
        {hoverCard}
      </div>
    </div>
  );
}
