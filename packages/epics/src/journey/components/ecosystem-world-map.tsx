'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
} from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  hasSpaceMapLocation,
  Space,
} from '@hypha-platform/core/client';
import { getDhoPathDefaultLanding } from '../../common/get-path-function';
import { loadLandGeo } from '../../network-map/lib/load-land-geo';
import { type WellbeingDimension } from '../wellbeing-model';
import {
  createWorldProjection,
  dimensionForSpace,
  ECOSYSTEM_MAP_HEIGHT,
  ECOSYSTEM_MAP_SCALE_EXTENT,
  ECOSYSTEM_MAP_WIDTH,
  projectLngLat,
  spaceMapPreviewMeta,
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
  const [activeSpaceId, setActiveSpaceId] = useState<number | null>(null);
  const hideCardTimeoutRef = useRef<number | null>(null);

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

  const activePin = useMemo(
    () => pins.find((pin) => pin.space.id === activeSpaceId) ?? null,
    [activeSpaceId, pins],
  );

  const showSpaceCard = (spaceId: number) => {
    if (hideCardTimeoutRef.current != null) {
      window.clearTimeout(hideCardTimeoutRef.current);
      hideCardTimeoutRef.current = null;
    }
    setActiveSpaceId(spaceId);
  };

  const scheduleHideSpaceCard = () => {
    if (hideCardTimeoutRef.current != null) {
      window.clearTimeout(hideCardTimeoutRef.current);
    }
    hideCardTimeoutRef.current = window.setTimeout(() => {
      setActiveSpaceId(null);
      hideCardTimeoutRef.current = null;
    }, 140);
  };

  useEffect(() => {
    return () => {
      if (hideCardTimeoutRef.current != null) {
        window.clearTimeout(hideCardTimeoutRef.current);
      }
    };
  }, []);

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
            role="group"
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
              {pins.map(({ space, x, y, dimension }) => {
                const isActive = space.id === activeSpaceId;
                return (
                  <a
                    key={space.id}
                    href={spaceHrefForMap(lang, space.slug)}
                    aria-label={t('mapOpenSpace', { title: space.title })}
                    className="outline-none focus-visible:[outline:2px_solid_var(--ring)] focus-visible:[outline-offset:3px]"
                    onMouseEnter={() => showSpaceCard(space.id)}
                    onMouseLeave={scheduleHideSpaceCard}
                    onFocus={() => showSpaceCard(space.id)}
                    onBlur={scheduleHideSpaceCard}
                  >
                    <circle cx={x} cy={y} r={12} fill="transparent" />
                    <circle
                      cx={x}
                      cy={y}
                      r={isActive ? 7 : 5.5}
                      className={DIMENSION_DOT[dimension]}
                      opacity={0.92}
                      stroke="var(--background-1)"
                      strokeWidth={isActive ? 2 : 1.25}
                    />
                  </a>
                );
              })}
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
          {activePin ? (
            <EcosystemMapSpaceCard
              lang={lang}
              space={activePin.space}
              onPointerEnter={() => showSpaceCard(activePin.space.id)}
              onPointerLeave={scheduleHideSpaceCard}
            />
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-1 text-muted-foreground">
          <p>{t('mapHint')}</p>
          <p>{t('mapInteract')}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function spaceInitial(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || 'S';
}

function EcosystemMapSpaceCard({
  lang,
  space,
  onPointerEnter,
  onPointerLeave,
}: {
  lang: Locale;
  space: Space;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const t = useTranslations('Journey');
  const tCommon = useTranslations('Common');
  const href = spaceHrefForMap(lang, space.slug);
  const preview = spaceMapPreviewMeta(space);

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 right-14 z-20">
      <Link
        href={href}
        tabIndex={-1}
        aria-label={t('mapOpenSpace', { title: space.title })}
        className="pointer-events-auto block"
        onMouseEnter={onPointerEnter}
        onMouseLeave={onPointerLeave}
        onFocus={onPointerEnter}
        onBlur={onPointerLeave}
      >
        <Card className="craft-card-interactive flex items-center gap-3 p-3">
          <Avatar className="size-10 shrink-0 rounded-chrome">
            <AvatarImage
              src={space.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
              alt=""
            />
            <AvatarFallback className="rounded-chrome text-2">
              {spaceInitial(space.title)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-3 font-medium">{space.title}</p>
            {preview?.kind === 'members' ? (
              <p className="text-1 text-muted-foreground">
                <span className="text-foreground/80">{preview.count}</span>{' '}
                {tCommon('Members')}
              </p>
            ) : preview?.kind === 'description' ? (
              <p className="line-clamp-2 text-1 text-muted-foreground">
                {preview.text}
              </p>
            ) : null}
          </div>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </Card>
      </Link>
    </div>
  );
}

export function spaceHrefForMap(lang: Locale, slug: string) {
  return getDhoPathDefaultLanding(lang, slug);
}
