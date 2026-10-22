'use client';

import useSWR from 'swr';
import { useJwt, type MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

import { MemberHomeInviteBanners } from './member-home-invite-banner';

/**
 * The email link opens the space with `?invite=`. Show that same pending
 * invite here so the recipient can join without hunting for Home.
 */
export function SpaceInviteArrival({
  lang,
  token,
}: {
  lang: Locale;
  token: string;
}) {
  const { jwt } = useJwt();
  const trimmed = token.trim();
  const { data } = useSWR<MemberIntelligence | null>(
    jwt && trimmed ? ['/api/v1/people/me/intelligence', jwt, trimmed] : null,
    async ([url, accessToken]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
  );

  const invite = data?.invites.find((row) => row.token === trimmed);
  if (!invite) return null;

  return <MemberHomeInviteBanners lang={lang} invites={[invite]} />;
}
