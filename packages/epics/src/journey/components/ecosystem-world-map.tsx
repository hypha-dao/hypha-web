'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { getDhoPathDefaultLanding } from '../../common/get-path-function';
import {
  WELLBEING_DIMENSIONS,
  type WellbeingDimension,
} from '../wellbeing-model';
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

function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 480,
  };
}

function dimensionForSpace(space: Space, index: number): WellbeingDimension {
  const categories = space.categories ?? [];
  if (categories.some((c) => /health|well|inner|care/i.test(c))) return 'being';
  if (categories.some((c) => /educat|research|tech/i.test(c)))
    return 'thinking';
  if (categories.some((c) => /social|community|culture/i.test(c)))
    return 'relating';
  if (categories.some((c) => /govern|network|dao/i.test(c)))
    return 'collaborating';
  if (categories.some((c) => /energy|environment|food|econom/i.test(c))) {
    return 'acting';
  }
  return WELLBEING_DIMENSIONS[index % WELLBEING_DIMENSIONS.length] ?? 'acting';
}

export function EcosystemWorldMap({
  lang,
  spaces,
  href,
  className,
}: EcosystemWorldMapProps) {
  const t = useTranslations('Journey');
  const located = useMemo(
    () =>
      spaces.filter(
        (space) =>
          typeof space.latitude === 'number' &&
          typeof space.longitude === 'number',
      ),
    [spaces],
  );

  const pins = useMemo(() => {
    if (located.length > 0) {
      return located.map((space, index) => ({
        space,
        ...project(space.latitude as number, space.longitude as number),
        dimension: dimensionForSpace(space, index),
      }));
    }
    return spaces.slice(0, 36).map((space, index) => {
      const angle = (index / Math.max(spaces.length, 1)) * Math.PI * 2;
      const radius = 90 + (index % 5) * 28;
      return {
        space,
        x: 500 + Math.cos(angle) * radius,
        y: 230 + Math.sin(angle) * (radius * 0.45),
        dimension: dimensionForSpace(space, index),
      };
    });
  }, [located, spaces]);

  const content = (
    <Card className={`wb-scope craft-card overflow-hidden ${className ?? ''}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
              {t('mapTitle')}
            </h3>
            <p className="mt-1 max-w-xl text-2 text-muted-foreground">
              {t('mapLead')}
            </p>
          </div>
          <p className="text-1 text-muted-foreground">
            {t('mapTotals', {
              places: located.length || spaces.length,
              hubs: spaces.length,
            })}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background">
          <svg
            viewBox="0 0 1000 480"
            className="h-auto w-full"
            role="img"
            aria-label={t('mapTitle')}
          >
            <rect width="1000" height="480" fill="var(--background-1)" />
            <g fill="var(--neutral-4)" stroke="none">
              <ellipse cx="220" cy="170" rx="150" ry="90" />
              <ellipse cx="280" cy="310" rx="70" ry="110" />
              <ellipse cx="500" cy="150" rx="70" ry="50" />
              <ellipse cx="520" cy="270" rx="85" ry="120" />
              <ellipse cx="700" cy="190" rx="180" ry="110" />
              <ellipse cx="820" cy="340" rx="55" ry="40" />
            </g>
            {pins.map(({ space, x, y, dimension }) => (
              <circle
                key={space.id}
                cx={x}
                cy={y}
                r={located.length > 0 ? 5 : 4}
                className={DIMENSION_DOT[dimension]}
              >
                <title>{space.title}</title>
              </circle>
            ))}
          </svg>
          <p className="absolute bottom-2 right-3 text-1 text-muted-foreground">
            {t('mapHint')}
          </p>
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

  if (!href) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

export function spaceHrefForMap(lang: Locale, slug: string) {
  return getDhoPathDefaultLanding(lang, slug);
}
