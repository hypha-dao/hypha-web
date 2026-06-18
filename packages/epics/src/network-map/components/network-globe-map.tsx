'use client';

import * as React from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import { Loader2 } from 'lucide-react';
import { NetworkMapLayerControls } from './network-map-layer-controls';
import type {
  NetworkGlobeMapProps,
  NetworkMapLayerVisibility,
  NetworkMapProjectionMode,
} from '../lib/types';
import { loadLandGeo } from '../lib/load-land-geo';
import { cartesian, rotationDelta } from '../lib/versor';
const PROJECTION_ANIMATION_MS = 1200;

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

export function NetworkGlobeMap({
  lang,
  pins,
  className,
}: NetworkGlobeMapProps) {
  const t = useTranslations('NetworkMap');
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const [layers, setLayers] = React.useState<NetworkMapLayerVisibility>({
    land: true,
    water: true,
    graticule: false,
  });
  const [projectionMode, setProjectionMode] =
    React.useState<NetworkMapProjectionMode>('globe');
  const [morphProgress, setMorphProgress] = React.useState(0);
  const [isLoadingGeo, setIsLoadingGeo] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const landRef = React.useRef<d3.GeoPermissibleObjects | null>(null);
  const rotateRef = React.useRef<[number, number, number]>([0, -20, 0]);
  const projectionModeRef = React.useRef(projectionMode);
  const morphRef = React.useRef(morphProgress);
  const layersRef = React.useRef(layers);
  const pinsRef = React.useRef(pins);
  const dragSurfaceRef = React.useRef<[number, number, number] | null>(null);
  const rotateStartRef = React.useRef<[number, number, number]>([0, -20, 0]);
  const animationFrameRef = React.useRef<number | null>(null);

  projectionModeRef.current = projectionMode;
  morphRef.current = morphProgress;
  layersRef.current = layers;
  pinsRef.current = pins;

  const renderMap = React.useCallback(() => {
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const land = landRef.current;
    if (!container || !land) {
      return;
    }

    const width = container.clientWidth;
    const height = Math.max(360, Math.min(560, width * 0.62));
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const mode = projectionModeRef.current;
    const morph = morphRef.current;
    const rotate = rotateRef.current;
    const minDim = Math.min(width, height);
    const globeScale = minDim / 2 - 24;
    const flatScale = width / (2 * Math.PI);

    const useFlat = mode === 'flat' || morph >= 1;
    const useGlobe = mode === 'globe' && morph <= 0;

    let projection: d3.GeoProjection;
    if (useFlat) {
      projection = d3
        .geoEquirectangular()
        .scale(flatScale)
        .translate([width / 2, height / 2])
        .rotate(rotate);
    } else if (useGlobe) {
      projection = d3
        .geoOrthographic()
        .scale(globeScale)
        .translate([width / 2, height / 2])
        .rotate(rotate)
        .clipAngle(90);
    } else {
      const tMorph = morph;
      const scale = globeScale * (1 - tMorph) + flatScale * tMorph;
      if (tMorph < 0.5) {
        projection = d3
          .geoOrthographic()
          .scale(scale)
          .translate([width / 2, height / 2])
          .rotate(rotate)
          .clipAngle(90 - tMorph * 45);
      } else {
        projection = d3
          .geoEquirectangular()
          .scale(scale)
          .translate([width / 2, height / 2])
          .rotate(rotate);
      }
    }

    const path = d3.geoPath(projection);
    const layerState = layersRef.current;

    const root = svg.selectAll<SVGGElement, unknown>('g.map-root').data([null]);
    const rootEnter = root.enter().append('g').attr('class', 'map-root');
    const rootMerge = rootEnter.merge(root);

    rootMerge.selectAll('*').remove();

    if (layerState.water) {
      rootMerge
        .append('path')
        .attr('class', 'map-ocean')
        .attr('d', path({ type: 'Sphere' }) ?? '')
        .attr('fill', 'var(--blue-4, #1e3a5f)')
        .attr('stroke', 'none');
    }

    if (layerState.graticule) {
      rootMerge
        .append('path')
        .attr('class', 'map-graticule')
        .attr('d', path(d3.geoGraticule10()) ?? '')
        .attr('fill', 'none')
        .attr('stroke', 'var(--neutral-8, #888)')
        .attr('stroke-width', 0.4)
        .attr('opacity', 0.45);
    }

    if (layerState.land) {
      rootMerge
        .append('path')
        .attr('class', 'map-land')
        .attr('d', path(land) ?? '')
        .attr('fill', 'var(--neutral-6, #444)')
        .attr('stroke', 'var(--neutral-9, #ccc)')
        .attr('stroke-width', 0.5);
    }

    const pinGroup = rootMerge.append('g').attr('class', 'map-pins');
    for (const pin of pinsRef.current) {
      const projected = projection([pin.longitude, pin.latitude]);
      if (!projected) {
        continue;
      }
      const [x, y] = projected;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }

      const pinNode = pinGroup
        .append('g')
        .attr('class', 'map-pin')
        .attr('transform', `translate(${x},${y})`)
        .attr('cursor', 'pointer')
        .on('click', () => {
          router.push(`/${lang}/dho/${pin.slug}/agreements`);
        });

      pinNode
        .append('circle')
        .attr('r', 5)
        .attr('fill', pinColor(pin.id))
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5);

      pinNode.append('title').text(pin.locationLabel ?? pin.title);
    }
  }, [lang, router]);

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
        renderMap();
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
  }, [renderMap]);

  React.useEffect(() => {
    renderMap();
  }, [layers, morphProgress, projectionMode, pins, renderMap]);

  React.useEffect(() => {
    const container = containerRef.current;
    const svgElement = svgRef.current;
    if (!container || !svgElement) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      renderMap();
    });
    resizeObserver.observe(container);

    const dragBehavior = d3
      .drag<SVGSVGElement, unknown>()
      .on('start', (event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) => {
        const invert = getProjection()?.invert?.([event.x, event.y]);
        if (!invert) {
          dragSurfaceRef.current = null;
          return;
        }
        dragSurfaceRef.current = cartesian(invert);
        rotateStartRef.current = [...rotateRef.current];
      })
      .on('drag', (event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) => {
        const invert = getProjection()?.invert?.([event.x, event.y]);
        const surface = dragSurfaceRef.current;
        if (!invert || !surface) {
          return;
        }
        const delta = rotationDelta(surface, cartesian(invert));
        rotateRef.current = [
          rotateStartRef.current[0] + delta[0],
          rotateStartRef.current[1] + delta[1],
          rotateStartRef.current[2],
        ];
        renderMap();
      })
      .on('end', () => {
        dragSurfaceRef.current = null;
      });

    d3.select(svgElement).call(dragBehavior);

    function getProjection() {
      const width = container!.clientWidth;
      const height = Math.max(360, Math.min(560, width * 0.62));
      const rotate = rotateRef.current;
      const minDim = Math.min(width, height);
      const mode = projectionModeRef.current;
      const morph = morphRef.current;

      if (mode === 'flat' || morph >= 1) {
        return d3
          .geoEquirectangular()
          .scale(width / (2 * Math.PI))
          .translate([width / 2, height / 2])
          .rotate(rotate);
      }
      return d3
        .geoOrthographic()
        .scale(minDim / 2 - 24)
        .translate([width / 2, height / 2])
        .rotate(rotate)
        .clipAngle(90);
    }

    return () => {
      resizeObserver.disconnect();
      d3.select(svgElement).on('.drag', null);
    };
  }, [renderMap]);

  const animateProjection = React.useCallback(
    (target: NetworkMapProjectionMode) => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const fromMode = projectionModeRef.current;
      if (fromMode === target) {
        return;
      }

      if (prefersReducedMotion()) {
        setMorphProgress(target === 'flat' ? 1 : 0);
        setProjectionMode(target);
        return;
      }

      const start = performance.now();
      const fromMorph = fromMode === 'flat' ? 1 : 0;
      const toMorph = target === 'flat' ? 1 : 0;

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / PROJECTION_ANIMATION_MS);
        const eased = d3.easeCubicInOut(t);
        setMorphProgress(fromMorph + (toMorph - fromMorph) * eased);
        if (t < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        } else {
          animationFrameRef.current = null;
          setProjectionMode(target);
          setMorphProgress(toMorph);
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);
    },
    [],
  );

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (pins.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-6 bg-neutral-2/50 p-8 text-center',
          className,
        )}
      >
        <p className="text-4 text-neutral-11">{t('noSpacesWithLocation')}</p>
        <p className="text-2 text-neutral-10">
          {t('noSpacesWithLocationHint')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <NetworkMapLayerControls
        layers={layers}
        projectionMode={projectionMode}
        onLayerChange={(layer, visible) =>
          setLayers((current) => ({ ...current, [layer]: visible }))
        }
        onProjectionModeChange={animateProjection}
      />
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-neutral-6 bg-neutral-1"
      >
        {isLoadingGeo ? (
          <div className="flex min-h-[360px] items-center justify-center gap-2 text-neutral-11">
            <Loader2 className="size-5 animate-spin" />
            <span>{t('loadingMap')}</span>
          </div>
        ) : loadError ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center text-3 text-neutral-11">
            {loadError}
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="block w-full touch-none select-none"
            role="img"
            aria-label={t('mapAriaLabel')}
          />
        )}
      </div>
    </div>
  );
}
