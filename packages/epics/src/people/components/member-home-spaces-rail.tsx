'use client';

import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { Locale } from '@hypha-platform/i18n';
import type { MemberIntelligence } from '@hypha-platform/core/client';

import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';

type HomeSpace = MemberIntelligence['spaces'][number];

const RAIL_ICON = 40;

export function MemberHomeSpacesRail({
  lang,
  spaces,
  isLoading,
}: {
  lang: Locale;
  spaces: HomeSpace[];
  isLoading?: boolean;
}) {
  const t = useTranslations('MemberHome');
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <nav
      aria-label={t('spacesRail')}
      className="narrow-scrollbar flex h-full w-[3.75rem] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-background py-3"
    >
      {isLoading ? (
        <>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton
              key={index}
              loading
              width={`${RAIL_ICON}px`}
              height={`${RAIL_ICON}px`}
              className="shrink-0 rounded-full bg-foreground/10"
            />
          ))}
        </>
      ) : spaces.length === 0 ? (
        <Link
          href={`/${lang}/my-spaces`}
          title={t('openMySpaces')}
          aria-label={t('openMySpaces')}
          className={cn(
            'grid place-items-center rounded-full border border-dashed border-border text-neutral-11',
            'hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
          style={{ width: RAIL_ICON, height: RAIL_ICON }}
        >
          <LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </Link>
      ) : (
        <>
          {spaces.map((space) => {
            const iconUrl = resolveSpaceDisplayLogoUrl(space, logoVariant);
            return (
              <Link
                key={space.id}
                href={`/${lang}/dho/${space.slug}/overview`}
                title={space.title}
                aria-label={space.title}
                className={cn(
                  'group relative shrink-0 overflow-hidden rounded-full bg-neutral-3',
                  'ring-1 ring-transparent transition-[box-shadow,transform] hover:ring-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                style={{ width: RAIL_ICON, height: RAIL_ICON }}
              >
                {iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-2 font-medium text-foreground"
                    aria-hidden
                  >
                    {space.title.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href={`/${lang}/my-spaces`}
            title={t('openMySpaces')}
            aria-label={t('openMySpaces')}
            className={cn(
              'mt-1 grid shrink-0 place-items-center rounded-full border border-border text-neutral-11',
              'hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
            style={{ width: RAIL_ICON, height: RAIL_ICON }}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </Link>
        </>
      )}
    </nav>
  );
}
