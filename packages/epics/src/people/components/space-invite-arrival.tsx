'use client';

import type { Locale } from '@hypha-platform/i18n';

import { useMemberIntelligence } from '../../common/member-intelligence-swr';
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
  const trimmed = token.trim();
  const { data } = useMemberIntelligence(trimmed || null, {
    enabled: Boolean(trimmed),
  });

  const invite = data?.invites?.find((row) => row.token === trimmed);
  if (!invite) return null;

  return <MemberHomeInviteBanners lang={lang} invites={[invite]} />;
}
