'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

import { useMemberIntelligence } from '../../common/member-intelligence-swr';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import {
  isMemberMobilePersona,
  memberSpaceHomeHref,
  pickMemberFocusSpaceSlug,
} from './member-mobile-nav';

/**
 * Members do not use the network home. They open in their space.
 * Everyone else keeps the general home.
 */
export function MemberHomeEntry({
  lang,
  children,
}: {
  lang: Locale;
  children: ReactNode;
}) {
  const { person, isLoading } = useMe();
  const member = isMemberMobilePersona(person?.primaryOrientation);
  const { data } = useMemberIntelligence(undefined, { enabled: member });
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() =>
    readRecentSpaceSlugs(),
  );
  const router = useRouter();

  useEffect(() => subscribeRecentSpaceSlugs(setRecentSlugs), []);

  const slug = member
    ? pickMemberFocusSpaceSlug({
        pathSlug: null,
        recentSlugs,
        membershipSlugs: data?.spaces.map((space) => space.slug) ?? [],
        membershipsLoaded: data != null,
      })
    : null;

  useEffect(() => {
    if (!member || !slug) return;
    router.replace(memberSpaceHomeHref(lang, slug));
  }, [lang, member, router, slug]);

  if (!member) {
    if (isLoading && person === undefined) return null;
    return children;
  }
  if (slug || data == null) return null;
  return children;
}
