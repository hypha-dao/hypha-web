'use client';

import * as React from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
const PROJECTION_ANIMATION_MS = 1200;
const DEFAULT_GLOBE_ROTATION: Rotation = [0, -20, 0];
const FLAT_ROTATION: Rotation = [0, 0, 0];

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
}: NetworkGlobeMapProps) {
  const t = useTranslations('NetworkMap');
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const locatedSpaces = React.useMemo(
    () => spaces.filter(hasSpaceMapLocation),
    [spaces],
  );

  const [hoveredPin, setHoveredPin] = React.useState<{
    spaceId: number;
    x: number;
    y: number;
  } | null>(null);
  const setHoveredPinRef = React.useRef(setHoveredPin);
  setHoveredPinRef.current = setHoveredPin;

  const [layers, setLayers] = React.useState<NetworkMapLayerVisibility>({
    land: true,
    water: true,
    graticule: false,
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

  const updateHoveredPinRef = React.useRef(updateHoveredPin);
  const clearHoveredPinRef = React.useRef(clearHoveredPin);
  updateHoveredPinRef.current = updateHoveredPin;
  clearHoveredPinRef.current = clearHoveredPin;

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

    let root = svg.select<SVGGElement>('g.map-root');
    if (root.empty()) {
      root = svg.append('g').attr('class', 'map-root');
      root.append('path').attr('class', 'map-ocean');
      root.append('path').attr('class', 'map-graticule');
      root.append('path').attr('class', 'map-land');
      root.append('g').attr('class', 'map-pins');
    }

    const ocean = root.select<SVGPathElement>('path.map-ocean');
    if (layerState.water) {
      ocean
        .attr('d', path({ type: 'Sphere' }) ?? '')
        .attr('fill', 'var(--blue-4, #1e3a5f)')
        .attr('stroke', 'none')
        .style('display', null);
    } else {
      ocean.attr('d', null).style('display', 'none');
    }

    const graticule = root.select<SVGPathElement>('path.map-graticule');
    if (layerState.graticule) {
      graticule
        .attr('d', path(d3.geoGraticule10()) ?? '')
        .attr('fill', 'none')
        .attr('stroke', 'var(--neutral-8, #888)')
        .attr('stroke-width', 0.4)
        .attr('opacity', 0.45)
        .style('display', null);
    } else {
      graticule.attr('d', null).style('display', 'none');
    }

    const landPath = root.select<SVGPathElement>('path.map-land');
    if (layerState.land) {
      landPath
        .attr('d', path(land) ?? '')
        .attr('fill', 'var(--neutral-6, #444)')
        .attr('stroke', 'var(--neutral-9, #ccc)')
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
      .on('click', (_event, space) => {
        router.push(`/${lang}/dho/${space.slug}/agreements`);
      })
      .on('mouseenter', function (event: MouseEvent, space) {
        if (isDraggingRef.current) {
          return;
        }
        updateHoveredPinRef.current(space.id, event);
      })
      .on('mousemove', function (event: MouseEvent, space) {
        if (isDraggingRef.current) {
          return;
        }
        updateHoveredPinRef.current(space.id, event);
      })
      .on('mouseleave', () => {
        if (isDraggingRef.current) {
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

  const requestRender = React.useCallback(() => {
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
        setLoadError(
          error instanceof Error ? error.message : 'Failed to load map data',
        );
        setIsLoadingGeo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scheduleRender]);

  React.useEffect(() => {
    if (isLoadingGeo || loadError || !landRef.current) {
      return;
    }
    scheduleRender();
  }, [isLoadingGeo, loadError, scheduleRender]);

  React.useEffect(() => {
    renderMap();
  }, [layers, morphProgress, projectionMode, locatedSpaces, renderMap]);

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
        clearHoveredPinRef.current();

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

  const hoveredSpace = hoveredPin
    ? locatedSpaces.find((space) => space.id === hoveredPin.spaceId)
    : null;

  const hoverCard =
    hoveredSpace && hoveredPin ? (
      <NetworkMapPinHoverCard
        lang={lang}
        space={hoveredSpace}
        {...clampHoverPosition(
          hoveredPin.x,
          hoveredPin.y,
          containerRef.current?.clientWidth ?? 640,
          containerRef.current?.clientHeight ?? 360,
        )}
      />
    ) : null;

  if (locatedSpaces.length === 0) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <NetworkMapLayerControls
          layers={layers}
          projectionMode={selectedProjection}
          onLayerChange={(layer, visible) =>
            setLayers((current) => ({ ...current, [layer]: visible }))
          }
          onProjectionModeChange={animateProjection}
        />
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
    <div className={cn('flex flex-col gap-4', className)}>
      <NetworkMapLayerControls
        layers={layers}
        projectionMode={selectedProjection}
        onLayerChange={(layer, visible) =>
          setLayers((current) => ({ ...current, [layer]: visible }))
        }
        onProjectionModeChange={animateProjection}
      />
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
