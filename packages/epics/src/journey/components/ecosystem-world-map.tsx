'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { hasSpaceMapLocation, Space } from '@hypha-platform/core/client';
import { getDhoPathDefaultLanding } from '../../common/get-path-function';
import { loadLandGeo } from '../../network-map/lib/load-land-geo';
import {
  WELLBEING_DIMENSIONS,
  type WellbeingDimension,
} from '../wellbeing-model';
import {
  createWorldProjection,
  dimensionForSpace,
  ECOSYSTEM_MAP_HEIGHT,
  ECOSYSTEM_MAP_SCALE_EXTENT,
  ECOSYSTEM_MAP_WIDTH,
  projectLngLat,
} from '../ecosystem-map';
import '../wellbeing-accents.css';

type EcosystemWorldMapProps = {
  lang: Locale;
  spaces: Space[];
  href?: string;
  className?: string;
};

const DIMENSION_DOT: Record<WellbeingDimension, string> = {
  being: 'wb-fill-being',
  thinking: 'wb-fill-thinking',
  relating: 'wb-fill-relating',
  collaborating: 'wb-fill-collaborating',
  acting: 'wb-fill-acting',
};

type MapPin = {
  space: Space;
  x: number;
  y: number;
  dimension: WellbeingDimension;
};

export function EcosystemWorldMap({
  lang,
  spaces,
  href,
  className,
}: EcosystemWorldMapProps) {
  const t = useTranslations('Journey');
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);
  const [landPath, setLandPath] = useState<string | null>(null);
  const [projection, setProjection] = useState(() =>
    createWorldProjection(null),
  );

  const located = useMemo(() => spaces.filter(hasSpaceMapLocation), [spaces]);

  const pins = useMemo(() => {
    const next: MapPin[] = [];
    located.forEach((space, index) => {
      const point = projectLngLat(
        projection,
        space.latitude as number,
        space.longitude as number,
      );
      if (!point) return;
      next.push({
        space,
        ...point,
        dimension: dimensionForSpace(space.categories, index),
      });
    });
    return next;
  }, [located, projection]);

  useEffect(() => {
    let cancelled = false;

    loadLandGeo()
      .then((land) => {
        if (cancelled) return;
        const nextProjection = createWorldProjection(land);
        const path = d3.geoPath(nextProjection);
        setProjection(() => nextProjection);
        setLandPath(path(land) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setProjection(() => createWorldProjection(null));
          setLandPath(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const layer = zoomLayerRef.current;
    if (!svg || !layer) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(ECOSYSTEM_MAP_SCALE_EXTENT)
      .extent([
        [0, 0],
        [ECOSYSTEM_MAP_WIDTH, ECOSYSTEM_MAP_HEIGHT],
      ])
      .translateExtent([
        [0, 0],
        [ECOSYSTEM_MAP_WIDTH, ECOSYSTEM_MAP_HEIGHT],
      ])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        d3.select(layer).attr('transform', event.transform.toString());
      });

    d3.select(svg).call(zoom);
    zoomBehaviorRef.current = zoom;

    return () => {
      d3.select(svg).on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, [landPath]);

  const stepZoom = (factor: number) => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svg || !zoom) return;
    d3.select(svg).transition().duration(220).call(zoom.scaleBy, factor);
  };

  const title = href ? (
    <Link href={href} className="hover:underline">
      {t('mapTitle')}
    </Link>
  ) : (
    t('mapTitle')
  );

  return (
    <Card className={`wb-scope craft-card overflow-hidden ${className ?? ''}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
              {title}
            </h3>
            <p className="mt-1 max-w-xl text-2 text-muted-foreground">
              {t('mapLead')}
            </p>
          </div>
          <p className="text-1 text-muted-foreground">
            {t('mapTotals', {
              places: located.length,
              hubs: spaces.length,
            })}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${ECOSYSTEM_MAP_WIDTH} ${ECOSYSTEM_MAP_HEIGHT}`}
            className="h-auto w-full cursor-grab active:cursor-grabbing touch-none"
            role="img"
            aria-label={t('mapTitle')}
          >
            <defs>
              <pattern
                id={`${uid}-ocean`}
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r="0.45" fill="var(--neutral-6)" />
              </pattern>
              <pattern
                id={`${uid}-land`}
                width="5.5"
                height="5.5"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1.2" cy="1.2" r="0.95" fill="var(--neutral-8)" />
              </pattern>
            </defs>
            <rect
              width={ECOSYSTEM_MAP_WIDTH}
              height={ECOSYSTEM_MAP_HEIGHT}
              fill="var(--background-1)"
            />
            <g ref={zoomLayerRef}>
              <rect
                x={-ECOSYSTEM_MAP_WIDTH}
                y={-ECOSYSTEM_MAP_HEIGHT}
                width={ECOSYSTEM_MAP_WIDTH * 3}
                height={ECOSYSTEM_MAP_HEIGHT * 3}
                fill={`url(#${uid}-ocean)`}
              />
              {landPath ? (
                <path d={landPath} fill={`url(#${uid}-land)`} />
              ) : null}
              {pins.map(({ space, x, y, dimension }) => (
                <a
                  key={space.id}
                  href={spaceHrefForMap(lang, space.slug)}
                  aria-label={space.title}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={5.5}
                    className={DIMENSION_DOT[dimension]}
                    opacity={0.92}
                    stroke="var(--background-1)"
                    strokeWidth={1.25}
                  >
                    <title>{space.title}</title>
                  </circle>
                </a>
              ))}
            </g>
          </svg>
          <div className="absolute bottom-2 right-2 flex flex-col overflow-hidden rounded-chrome border border-border/70 bg-background/90 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              size="icon"
              className="size-8 rounded-none"
              onClick={() => stepZoom(1.35)}
              aria-label={t('mapZoomIn')}
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              size="icon"
              className="size-8 rounded-none border-t border-border/70"
              onClick={() => stepZoom(1 / 1.35)}
              aria-label={t('mapZoomOut')}
            >
              <Minus className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-1 text-muted-foreground">
          <p>{t('mapHint')}</p>
          <p>{t('mapInteract')}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-1 text-muted-foreground">
          {WELLBEING_DIMENSIONS.map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${DIMENSION_DOT[key].replace(
                  'wb-fill',
                  'wb-dot',
                )}`}
              />
              {t(`dimension.${key}`)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function spaceHrefForMap(lang: Locale, slug: string) {
  return getDhoPathDefaultLanding(lang, slug);
}
