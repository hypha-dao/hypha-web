'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from '@hypha-platform/ui';
import { useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useMemo } from 'react';

const BREADCRUMB_ORIGIN_COOKIE = 'breadcrumb_origin';
const COOKIE_MAX_AGE_DAYS = 1;

type BreadcrumbOrigin = 'network' | 'profile' | 'my-spaces';

function getBreadcrumbOriginFromCookie(): {
  from: BreadcrumbOrigin;
  profileSlug?: string;
} | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${BREADCRUMB_ORIGIN_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as {
      from: BreadcrumbOrigin;
      profileSlug?: string;
    };
  } catch {
    return null;
  }
}

function setBreadcrumbOriginCookie(from: BreadcrumbOrigin, profileSlug?: string) {
  if (typeof document === 'undefined') return;
  const value = JSON.stringify(
    profileSlug ? { from, profileSlug } : { from },
  );
  document.cookie = `${BREADCRUMB_ORIGIN_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * COOKIE_MAX_AGE_DAYS}; SameSite=Lax`;
}

function getFromQuery(from: BreadcrumbOrigin, profileSlug?: string): string {
  if (from === 'profile' && profileSlug) {
    return `from=profile&profileSlug=${encodeURIComponent(profileSlug)}`;
  }
  return `from=${from}`;
}

const BreadcrumbFromContext = createContext<string | undefined>(undefined);

export function useBreadcrumbFrom() {
  return useContext(BreadcrumbFromContext);
}

/** Returns the from query string for preserving breadcrumb origin in links */
export function useBreadcrumbFromQuery(): string | undefined {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') as BreadcrumbOrigin | null;
  const profileSlug = searchParams.get('profileSlug');

  return useMemo(() => {
    let resolvedFrom = from;
    let resolvedProfileSlug = profileSlug;

    if (!resolvedFrom) {
      const cookie = getBreadcrumbOriginFromCookie();
      if (cookie) {
        resolvedFrom = cookie.from;
        resolvedProfileSlug = cookie.profileSlug ?? null;
      } else {
        return undefined;
      }
    }

    return getFromQuery(
      resolvedFrom,
      resolvedProfileSlug ?? undefined,
    );
  }, [from, profileSlug]);
}

export function BreadcrumbsRootSelector({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const params = useParams<{ lang: string }>();
  const lang = params?.lang ?? 'en';
  const tNavigation = useTranslations('Navigation');

  const from = searchParams.get('from') as BreadcrumbOrigin | null;
  const profileSlug = searchParams.get('profileSlug');

  const { rootHref, rootLabel, fromQuery } = useMemo(() => {
    let resolvedFrom = from;
    let resolvedProfileSlug = profileSlug;

    if (!resolvedFrom) {
      const cookie = getBreadcrumbOriginFromCookie();
      if (cookie) {
        resolvedFrom = cookie.from;
        resolvedProfileSlug = cookie.profileSlug ?? null;
      } else {
        resolvedFrom = 'my-spaces';
      }
    } else {
      setBreadcrumbOriginCookie(
        resolvedFrom,
        resolvedProfileSlug ?? undefined,
      );
    }

    let href: string;
    let label: string;

    switch (resolvedFrom) {
      case 'network':
        href = `/${lang}/network`;
        label = tNavigation('network');
        break;
      case 'profile':
        href = resolvedProfileSlug
          ? `/${lang}/profile/${resolvedProfileSlug}`
          : `/${lang}/profile`;
        label = tNavigation('profile');
        break;
      case 'my-spaces':
      default:
        href = `/${lang}/my-spaces`;
        label = tNavigation('mySpaces');
        break;
    }

    const query = getFromQuery(resolvedFrom, resolvedProfileSlug ?? undefined);

    return { rootHref: href, rootLabel: label, fromQuery: query };
  }, [from, profileSlug, lang, tNavigation]);

  useEffect(() => {
    if (from) {
      setBreadcrumbOriginCookie(from, profileSlug ?? undefined);
    }
  }, [from, profileSlug]);

  const contextValue = useMemo(() => fromQuery, [fromQuery]);

  return (
    <BreadcrumbFromContext.Provider value={contextValue}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={rootHref} className="flex items-center">
              {rootLabel}
            </BreadcrumbLink>
          </BreadcrumbItem>
          {children}
        </BreadcrumbList>
      </Breadcrumb>
    </BreadcrumbFromContext.Provider>
  );
}
