'use client';

import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { useJwt, type MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

import { NetworkSectionHeader } from '../../network-exchange/network-section-header';
import { MemberHomeSpacesWidgetCard } from './member-home-chat-widgets';

export function MemberSpacesStepIn({ lang }: { lang: Locale }) {
  const tSpaces = useTranslations('Spaces');
  const tHome = useTranslations('MemberHome');
  const { jwt } = useJwt();
  const { data, isLoading } = useSWR<MemberIntelligence | null>(
    jwt ? ['/api/v1/people/me/intelligence', jwt] : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
  );
  const spaces = data?.spaces ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <NetworkSectionHeader
            eyebrow={tSpaces('allYourSpaces')}
            title={tSpaces('inOnePlace')}
          />
        </div>
        {spaces.length > 0 ? (
          <p className="shrink-0 pt-1 text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
            {tHome('spacesWidgetCount', { count: spaces.length })}
          </p>
        ) : null}
      </div>
      {isLoading && data == null ? (
        <div aria-hidden>
          <div className="mb-4 h-28 bg-neutral-3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-2 py-2"
              >
                <span className="h-14 w-14 rounded-full bg-neutral-3" />
                <span className="h-3 w-16 bg-neutral-3" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <MemberHomeSpacesWidgetCard
          lang={lang}
          spaces={spaces}
          framed={false}
          limit={null}
        />
      )}
    </div>
  );
}
