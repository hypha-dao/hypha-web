'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import {
  memberMenuHref,
  readRecentSpaceSlugs,
  resolveMemberSpaceSlug,
  subscribeRecentSpaceSlugs,
  useMemberExperience,
  useMemberNamedSpaces,
} from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

type ProfileBackLinkProps = {
  lang: string;
  /**
   * `breadcrumb` — left-aligned chevron + label (builders/funders).
   * `action` — compact control for the member title actions slot (top right).
   */
  variant?: 'breadcrumb' | 'action';
};

/** Profile back control. Members return to their latest visited space. */
export function ProfileBackLink({
  lang,
  variant = 'breadcrumb',
}: ProfileBackLinkProps) {
  const tNav = useTranslations('Navigation');
  const { isMember: member } = useMemberExperience();
  const named = useMemberNamedSpaces();
  const [recent, setRecent] = useState<string[]>(() => readRecentSpaceSlugs());

  useEffect(() => subscribeRecentSpaceSlugs(setRecent), []);

  const spaceSlug = useMemo(
    () =>
      resolveMemberSpaceSlug({
        pathSlug: null,
        querySlug: null,
        memberSlugs: named.map((space) => space.slug),
        recentSlugs: recent,
      }),
    [named, recent],
  );
  const spaceTitle =
    named.find((space) => space.slug === spaceSlug)?.title?.trim() || null;

  if (member) {
    const href = spaceSlug
      ? memberMenuHref(lang, spaceSlug, 'home')
      : `/${lang}/home`;
    const label = spaceTitle || tNav('home');

    return (
      <Link
        href={href}
        className={cn(
          'flex min-w-0 max-w-[min(12rem,46vw)] cursor-pointer items-center gap-0.5',
          variant === 'action' && 'text-muted-foreground hover:text-foreground',
        )}
        aria-label={label}
      >
        <ChevronLeftIcon width={16} height={16} className="shrink-0" />
        <Text
          className={cn(
            'min-w-0 truncate',
            variant === 'action' ? 'text-1' : 'text-sm',
          )}
        >
          {label}
        </Text>
      </Link>
    );
  }

  return (
    <Link
      href={`/${lang}/my-spaces`}
      className="flex cursor-pointer items-center"
    >
      <ChevronLeftIcon width={16} height={16} />
      <Text className="text-sm">{tNav('mySpaces')}</Text>
    </Link>
  );
}
