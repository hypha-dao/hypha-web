'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@hypha-platform/ui';
import { ChevronRightIcon } from 'lucide-react';
import { Fragment } from 'react';

import type { BreadcrumbSegment } from './breadcrumbs';
import { useSpaceHeaderMorph } from './space-header-morph-context';

type StickySpaceBreadcrumbsInlineProps = {
  children: React.ReactNode;
};

/**
 * In-page breadcrumbs: fade/slide as they are “absorbed” into the fixed strip.
 */
export function StickySpaceBreadcrumbsInline({
  children,
}: StickySpaceBreadcrumbsInlineProps) {
  const { progress, reducedMotion } = useSpaceHeaderMorph();
  const absorbed = Math.min(1, progress * 1.35);
  const opacity = 1 - absorbed;

  return (
    <div
      className="min-h-[1.5rem]"
      style={{
        opacity,
        transform:
          reducedMotion || progress < 0.02
            ? undefined
            : `translateY(${-6 * absorbed}px)`,
        transition: reducedMotion
          ? undefined
          : 'opacity 0.2s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: opacity < 0.35 ? 'none' : undefined,
      }}
      aria-hidden={opacity < 0.1}
    >
      {children}
    </div>
  );
}

type AbsorbedBreadcrumbRowProps = {
  lang: string;
  rootHref: string;
  rootLabel: string;
  trail: BreadcrumbSegment[];
};

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Single portal row: breadcrumbs that appear as user scrolls (inside collapse portal). */
export function AbsorbedBreadcrumbRow({
  lang,
  rootHref,
  rootLabel,
  trail,
}: AbsorbedBreadcrumbRowProps) {
  const { progress, reducedMotion } = useSpaceHeaderMorph();
  const opacity = smoothstep(0.05, 0.28, progress);
  const lift = (1 - opacity) * 10;

  if (progress < 0.02) return null;

  return (
    <div
      className="border-b border-border/70 bg-background-2"
      style={{
        opacity,
        transform: reducedMotion ? undefined : `translateY(${lift}px)`,
        transition: reducedMotion
          ? undefined
          : 'opacity 0.2s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="mx-auto max-w-container-2xl px-4 py-1.5 sm:px-6">
        <Breadcrumb>
          <BreadcrumbList className="text-1 sm:text-2">
            <BreadcrumbItem>
              <BreadcrumbLink href={rootHref} className="truncate">
                {rootLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {trail.map((seg) => (
              <Fragment key={seg.slug}>
                <BreadcrumbSeparator>
                  <ChevronRightIcon className="size-3.5 sm:size-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem className="max-w-[min(70vw,28rem)]">
                  <BreadcrumbLink
                    href={`/${lang}/dho/${seg.slug}/agreements`}
                    className="truncate"
                  >
                    {seg.title}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
