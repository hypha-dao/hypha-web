'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
} from '@hypha-platform/ui';
import type { Locale } from '@hypha-platform/i18n';
import type { Space } from '@hypha-platform/core/client';
import type { NetworkSpaceRank } from '@hypha-platform/core/client';
import { NetworkRanking } from '../../network-exchange';
import { resolveSpaceDisplayLogoUrl } from '../utils/resolve-space-display-logo-url';

function excerpt(value: string | null | undefined) {
  const text = (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 180) return text;
  return `${text.slice(0, 179).trimEnd()}…`;
}

export function NetworkSidePanel({
  lang,
  selectedSpace,
  onSelectRank,
  ranks,
}: {
  lang: Locale;
  selectedSpace: Space;
  onSelectRank: (rank: NetworkSpaceRank) => void;
  ranks: NetworkSpaceRank[];
}) {
  const t = useTranslations('NetworkExchange');
  const tCommon = useTranslations('Common');
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const logo = resolveSpaceDisplayLogoUrl(selectedSpace, logoVariant);
  const initial = selectedSpace.title.trim().charAt(0).toUpperCase();
  const place = selectedSpace.locationLabel?.trim() ?? '';
  const summary = excerpt(selectedSpace.description);
  const spaceHref = selectedSpace.slug
    ? `/${lang}/dho/${selectedSpace.slug}/overview`
    : null;

  return (
    <aside
      aria-label={t('navNetwork')}
      className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[var(--menu-top-height)]"
    >
      <section className="border border-border bg-background p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-12 shrink-0 rounded-none">
            {logo ? (
              <AvatarImage src={logo} alt="" className="object-cover" />
            ) : null}
            <AvatarFallback className="rounded-none text-1">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2
              className="text-3"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {selectedSpace.title}
            </h2>
            {place ? (
              <p className="mt-1 text-1 text-neutral-11">{place}</p>
            ) : null}
          </div>
        </div>
        {summary ? (
          <p className="mt-3 text-1 leading-relaxed text-neutral-11">
            {summary}
          </p>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 border border-border">
          <div className="px-3 py-3">
            <dt className="text-1 uppercase tracking-[0.08em] text-neutral-11">
              {tCommon('Members')}
            </dt>
            <dd
              className="mt-1 text-3 tabular-nums"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {selectedSpace.memberCount ?? 0}
            </dd>
          </div>
          <div className="border-l border-border px-3 py-3">
            <dt className="text-1 uppercase tracking-[0.08em] text-neutral-11">
              {tCommon('Agreements')}
            </dt>
            <dd
              className="mt-1 text-3 tabular-nums"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {selectedSpace.documentCount ?? 0}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" disabled>
            {t('resource')}
          </Button>
          {spaceHref ? (
            <Link
              href={spaceHref}
              className="text-1 text-foreground underline-offset-4 hover:underline"
            >
              {t('visit')}
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-1 text-neutral-11">{t('resourceLater')}</p>
      </section>

      {ranks.length > 0 ? (
        <section className="border border-border bg-background p-4">
          <NetworkRanking lang={lang} ranks={ranks} onSelect={onSelectRank} />
        </section>
      ) : null}
    </aside>
  );
}
