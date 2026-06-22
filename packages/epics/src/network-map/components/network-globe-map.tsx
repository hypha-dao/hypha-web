'use client';

import * as React from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { cn } from '@hypha-platform/ui-utils';
import { Loader2, Minus } from 'lucide-react';
import { Button } from '@hypha-platform/ui';
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
import {
  buildMapPinData,
  pinDatumSpace,
  spiderfyOffsets,
  spiderfyRadiusPx,
  type MapPinDatum,
} from '../lib/pin-clusters';

const PROJECTION_ANIMATION_MS = 1200;
/** Cluster zoom-in duration — slightly shorter than before for a snappier camera feel. */
const CLUSTER_FOCUS_MS = 920;
/** Cluster zoom-out duration — matched to focus so in/out feel symmetric. */
const CLUSTER_BLUR_MS = 580;
const CLUSTER_ZOOM_SCALE = 4;
const MAX_MAP_ZOOM = 5;
const SPIDERFY_RADIUS = 36;
/** Spiderfy begins after this fraction of the focus animation (zoom-first). */
const SPIDERFY_START = 0.78;
/** Fast takeoff with a soft landing — reads like a camera dolly-in. */
const easeClusterZoomIn = d3.easeExpOut;
/** Smooth pull-back into the world view. */
const easeClusterZoomOut = d3.easePolyOut.exponent(4);
/** Gentle fan-out once zoom has mostly settled. */
const easeClusterSpreadIn = d3.easePolyOut.exponent(3);
/** Quick fold-in before zoom-out begins. */
const easeClusterSpreadOut = d3.easePolyIn.exponent(2);
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
  zoomScale = 1,
): d3.GeoProjection {
  const rotation = effectiveRotation(morph, rotate);
  const minDim = Math.min(width, height);
  const zoom = Math.max(0.75, Math.min(zoomScale, MAX_MAP_ZOOM));
  const globeScale = (minDim / 2 - 24) * zoom;
  const flatScale = (width / (2 * Math.PI)) * zoom;
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

  const [focusedClusterId, setFocusedClusterId] = React.useState<string | null>(
    null,
  );
  const [clusterSpread, setClusterSpread] = React.useState(0);

  const mapPinData = React.useMemo(
    () => buildMapPinData(locatedSpaces, focusedClusterId),
    [locatedSpaces, focusedClusterId],
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
  const mapPinDataRef = React.useRef(mapPinData);
  const focusedClusterIdRef = React.useRef<string | null>(null);
  const clusterSpreadRef = React.useRef(0);
  const globeZoomRef = React.useRef(1);
  const clusterAnimFrameRef = React.useRef<number | null>(null);
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
  mapPinDataRef.current = mapPinData;
  focusedClusterIdRef.current = focusedClusterId;
  clusterSpreadRef.current = clusterSpread;

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

  const [canHover, setCanHover] = React.useState(() => canUseHover());

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const syncCanHover = () => {
      const matches = mediaQuery.matches;
      canHoverRef.current = matches;
      setCanHover(matches);
      if (matches) {
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

  const animateClusterFocusRef = React.useRef<
    (cluster: Extract<MapPinDatum, { kind: 'cluster' }>) => void
  >(() => {});
  const clearClusterFocusRef = React.useRef<() => void>(() => {});

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
    const projection = buildProjection(
      width,
      height,
      morph,
      rotate,
      globeZoomRef.current,
    );
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
      root.append('g').attr('class', 'map-spiderfy');
      root.append('g').attr('class', 'map-pins');
    }

    if (root.select('g.map-spiderfy').empty()) {
      root.insert('g', 'g.map-pins').attr('class', 'map-spiderfy');
    }

    const spiderfyLayer = root.select<SVGGElement>('g.map-spiderfy');
    spiderfyLayer.selectAll('line').remove();

    const spread = clusterSpreadRef.current;
    const focusedClusterId = focusedClusterIdRef.current;
    const spiderfyRadius = spiderfyRadiusPx(
      SPIDERFY_RADIUS,
      globeZoomRef.current,
    );
    const spiderfyPins = mapPinDataRef.current.filter(
      (datum): datum is Extract<MapPinDatum, { kind: 'spiderfy-space' }> =>
        datum.kind === 'spiderfy-space',
    );

    if (focusedClusterId && spread > 0.01 && spiderfyPins.length > 0) {
      const anchor = spiderfyPins[0]!;
      const projectedAnchor = projection([anchor.longitude, anchor.latitude]);
      if (projectedAnchor) {
        const [centerX, centerY] = projectedAnchor;
        const offsets = spiderfyOffsets(
          anchor.spiderfyCount,
          spiderfyRadius * spread,
        );

        spiderfyLayer
          .selectAll<SVGLineElement, { x: number; y: number }>('line')
          .data(offsets)
          .join('line')
          .attr('x1', centerX)
          .attr('y1', centerY)
          .attr('x2', (_, index) => centerX + offsets[index]!.x)
          .attr('y2', (_, index) => centerY + offsets[index]!.y)
          .attr('stroke', 'white')
          .attr('stroke-opacity', 0.35 * spread)
          .attr('stroke-width', 1.25)
          .attr('stroke-dasharray', '4 4')
          .attr('pointer-events', 'none');
      }
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
      .selectAll<SVGGElement, MapPinDatum>('g.map-pin')
      .data(mapPinDataRef.current, (datum) => datum.pinKey);

    pins.exit().remove();

    const pinsEnter = pins
      .enter()
      .append('g')
      .attr('class', (datum) =>
        datum.kind === 'cluster' ? 'map-pin map-pin-cluster' : 'map-pin',
      )
      .attr('cursor', 'pointer')
      .attr('tabindex', 0)
      .attr('role', (datum) => (datum.kind === 'cluster' ? 'button' : 'link'))
      .on('pointerdown', (event: PointerEvent) => {
        event.stopPropagation();
        isDraggingRef.current = false;
      })
      .on('click', function (event: MouseEvent, datum) {
        event.stopPropagation();
        if (isDraggingRef.current) {
          return;
        }
        if (datum.kind === 'cluster') {
          animateClusterFocusRef.current(datum);
          return;
        }
        const space = pinDatumSpace(datum);
        if (!space) {
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
      .on('keydown', (event: KeyboardEvent, datum) => {
        if (datum.kind === 'cluster') {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            animateClusterFocusRef.current(datum);
          }
          return;
        }
        const space = pinDatumSpace(datum);
        if (!space) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(`/${lang}/dho/${space.slug}/agreements`);
        }
      })
      .on('mouseenter', function (event: MouseEvent, datum) {
        if (!canHoverRef.current || isDraggingRef.current) {
          return;
        }
        const space = pinDatumSpace(datum);
        if (!space) {
          return;
        }
        updateHoveredPinRef.current(space.id, event);
      })
      .on('mousemove', function (event: MouseEvent, datum) {
        if (!canHoverRef.current || isDraggingRef.current) {
          return;
        }
        const space = pinDatumSpace(datum);
        if (!space) {
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

    pinsEnter.each(function (datum) {
      const group = d3.select(this);
      if (datum.kind === 'cluster') {
        group
          .append('circle')
          .attr('class', 'map-pin-hit')
          .attr('r', 14)
          .attr('fill', 'transparent')
          .attr('pointer-events', 'all');
        group
          .append('circle')
          .attr('class', 'map-pin-cluster-pulse')
          .attr('r', 12)
          .attr('fill', 'none')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2)
          .attr('pointer-events', 'none');
        group
          .append('circle')
          .attr('r', 11)
          .attr('fill', 'white')
          .attr('opacity', 0.92)
          .attr('pointer-events', 'none');
        group
          .append('circle')
          .attr('r', 8)
          .attr('fill', '#2563eb')
          .attr('pointer-events', 'none');
        group
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', 10)
          .attr('font-weight', 600)
          .attr('fill', 'white')
          .attr('pointer-events', 'none')
          .text(String(datum.count));
        group
          .append('title')
          .text(t('clusterExpandTitle', { count: datum.count }));
        return;
      }

      const space = pinDatumSpace(datum);
      if (!space) {
        return;
      }

      group
        .append('circle')
        .attr('r', 12)
        .attr('fill', 'transparent')
        .attr('pointer-events', 'all');
      group
        .append('circle')
        .attr('class', 'map-pin-dot')
        .attr('r', 5)
        .attr('fill', pinColor(space.id))
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .attr('pointer-events', 'none');
      group.append('title').text(space.locationLabel ?? space.title);
    });

    pins.merge(pinsEnter).each(function (datum) {
      const group = d3.select(this);
      if (
        datum.kind === 'cluster' &&
        group.select('circle.map-pin-hit').empty()
      ) {
        group
          .insert('circle', ':first-child')
          .attr('class', 'map-pin-hit')
          .attr('r', 14)
          .attr('fill', 'transparent')
          .attr('pointer-events', 'all');
      }

      const latitude =
        datum.kind === 'cluster' || datum.kind === 'spiderfy-space'
          ? datum.latitude
          : datum.space.latitude;
      const longitude =
        datum.kind === 'cluster' || datum.kind === 'spiderfy-space'
          ? datum.longitude
          : datum.space.longitude;

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

      let offsetX = 0;
      let offsetY = 0;
      let pinOpacity = 'dimmed' in datum && datum.dimmed ? 0.28 : 1;
      let pinScale = 1;

      if (datum.kind === 'spiderfy-space') {
        const offsets = spiderfyOffsets(
          datum.spiderfyCount,
          spiderfyRadius * spread,
        );
        const offset = offsets[datum.spiderfyIndex] ?? { x: 0, y: 0 };
        offsetX = offset.x;
        offsetY = offset.y;
        pinOpacity = spread;
        pinScale = 0.65 + spread * 0.35;
      }

      d3.select(this)
        .attr(
          'transform',
          `translate(${x + offsetX},${y + offsetY}) scale(${pinScale})`,
        )
        .attr('opacity', pinOpacity)
        .style('display', null);
    });
  }, [lang, router, t]);

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

  const clearClusterFocus = React.useCallback(() => {
    if (!focusedClusterIdRef.current) {
      return;
    }

    if (clusterAnimFrameRef.current != null) {
      cancelAnimationFrame(clusterAnimFrameRef.current);
      clusterAnimFrameRef.current = null;
    }

    clearHoveredPinRef.current();
    clearSelectedPinRef.current();

    const fromZoom = globeZoomRef.current;
    const fromSpread = clusterSpreadRef.current;

    if (prefersReducedMotion()) {
      globeZoomRef.current = 1;
      clusterSpreadRef.current = 0;
      focusedClusterIdRef.current = null;
      setFocusedClusterId(null);
      setClusterSpread(0);
      requestRender();
      return;
    }

    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / CLUSTER_BLUR_MS);

      // Collapse spiderfy first, then zoom out so pins stay anchored.
      const spreadPhase = Math.min(1, t / 0.45);
      const zoomPhase = Math.max(0, (t - 0.35) / 0.65);
      const spreadRemaining = 1 - easeClusterSpreadOut(spreadPhase);
      const zoomRemaining = 1 - easeClusterZoomOut(zoomPhase);

      clusterSpreadRef.current = fromSpread * spreadRemaining;
      setClusterSpread(fromSpread * spreadRemaining);
      globeZoomRef.current = 1 + (fromZoom - 1) * zoomRemaining;
      requestRender();

      if (t < 1) {
        clusterAnimFrameRef.current = requestAnimationFrame(step);
      } else {
        globeZoomRef.current = 1;
        clusterSpreadRef.current = 0;
        focusedClusterIdRef.current = null;
        setFocusedClusterId(null);
        setClusterSpread(0);
        clusterAnimFrameRef.current = null;
        requestRender();
      }
    };

    clusterAnimFrameRef.current = requestAnimationFrame(step);
  }, [requestRender]);

  const animateClusterFocus = React.useCallback(
    (cluster: Extract<MapPinDatum, { kind: 'cluster' }>) => {
      if (clusterAnimFrameRef.current != null) {
        cancelAnimationFrame(clusterAnimFrameRef.current);
        clusterAnimFrameRef.current = null;
      }
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      clearHoveredPinRef.current();
      clearSelectedPinRef.current();

      const fromZoom = globeZoomRef.current;
      const toZoom = CLUSTER_ZOOM_SCALE;
      const centeredRotation = globeRotationForCenter(
        cluster.longitude,
        cluster.latitude,
      );

      focusedClusterIdRef.current = cluster.clusterId;
      setFocusedClusterId(cluster.clusterId);

      if (prefersReducedMotion()) {
        rotateRef.current = centeredRotation;
        globeZoomRef.current = toZoom;
        savedGlobeRotateRef.current = centeredRotation;
        clusterSpreadRef.current = 1;
        setClusterSpread(1);
        requestRender();
        return;
      }

      clusterSpreadRef.current = 0;
      setClusterSpread(0);
      const start = performance.now();
      savedGlobeRotateRef.current = centeredRotation;

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / CLUSTER_FOCUS_MS);

        // Keep the cluster anchor pinned at the viewport center while zooming.
        rotateRef.current = centeredRotation;
        globeZoomRef.current =
          fromZoom + (toZoom - fromZoom) * easeClusterZoomIn(t);

        const spreadT =
          t <= SPIDERFY_START ? 0 : (t - SPIDERFY_START) / (1 - SPIDERFY_START);
        const spread = easeClusterSpreadIn(spreadT);
        clusterSpreadRef.current = spread;
        setClusterSpread(spread);
        requestRender();

        if (t < 1) {
          clusterAnimFrameRef.current = requestAnimationFrame(step);
        } else {
          clusterSpreadRef.current = 1;
          setClusterSpread(1);
          clusterAnimFrameRef.current = null;
          requestRender();
        }
      };

      clusterAnimFrameRef.current = requestAnimationFrame(step);
    },
    [requestRender],
  );

  animateClusterFocusRef.current = animateClusterFocus;
  clearClusterFocusRef.current = clearClusterFocus;

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
    mapPinData,
    clusterSpread,
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
      return buildProjection(width, height, 0, rotate, globeZoomRef.current);
    }

    const dragBehavior = d3
      .drag<SVGSVGElement, unknown>()
      .filter((event) => {
        if (focusedClusterIdRef.current) {
          return false;
        }
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
      if (clusterAnimFrameRef.current != null) {
        cancelAnimationFrame(clusterAnimFrameRef.current);
        clusterAnimFrameRef.current = null;
      }
      if (focusedClusterIdRef.current) {
        focusedClusterIdRef.current = null;
        setFocusedClusterId(null);
        clusterSpreadRef.current = 0;
        setClusterSpread(0);
      }
      globeZoomRef.current = 1;

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
      if (clusterAnimFrameRef.current != null) {
        cancelAnimationFrame(clusterAnimFrameRef.current);
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
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        !target.closest('.map-pin') &&
        !target.closest('[data-network-map-hover-card]') &&
        !target.closest('[data-network-map-cluster-controls]')
      ) {
        if (focusedClusterIdRef.current) {
          clearClusterFocusRef.current();
        }
        if (!canHoverRef.current) {
          clearSelectedPinRef.current();
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && focusedClusterIdRef.current) {
        clearClusterFocusRef.current();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
        compact={!canHover}
        {...(canHover
          ? clampHoverPosition(
              activePin.x,
              activePin.y,
              containerRef.current?.clientWidth ?? 640,
              containerRef.current?.clientHeight ?? 360,
            )
          : {})}
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

  const clusterControls = focusedClusterId ? (
    <div
      data-network-map-cluster-controls
      className="absolute left-3 top-3 z-20"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 bg-neutral-2/90 shadow-sm backdrop-blur-sm"
        onClick={clearClusterFocus}
      >
        <Minus className="size-3.5" aria-hidden />
        {t('clusterZoomOut')}
      </Button>
    </div>
  ) : null;

  const mapClusterStyles = (
    <style>{`
      @keyframes network-map-cluster-pulse {
        0% { transform: scale(0.9); opacity: 0.55; }
        70% { transform: scale(1.45); opacity: 0; }
        100% { transform: scale(1.45); opacity: 0; }
      }
      g.map-pin-cluster .map-pin-cluster-pulse {
        transform-box: fill-box;
        transform-origin: center;
        animation: network-map-cluster-pulse 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      }
    `}</style>
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
        {mapClusterStyles}
        {clusterControls}
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
