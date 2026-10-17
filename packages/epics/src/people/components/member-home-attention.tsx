'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Radio, Scale } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { Skeleton } from '@hypha-platform/ui';
import {
  listMemberHomeAttentionItems,
  memberHomeItemsStillWaiting,
  type MemberHomeThreadItem,
  type MemberIntelligence,
} from '@hypha-platform/core/client';

import { getProposalPath, getSignalPath } from '../../common/get-path-function';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import {
  bindHomePerson,
  readHomeActed,
  readHomeChoices,
} from './member-home-resume';
import './member-home-banner.css';

function AttentionMark({
  kind,
  iconUrl,
}: {
  kind: MemberHomeThreadItem['kind'];
  iconUrl?: string | null;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const Icon = kind === 'proposal' ? Scale : Radio;
  const showLogo = Boolean(iconUrl) && !logoFailed;
  return (
    <span
      className="craft-icon-box text-foreground"
      style={{ width: 24, height: 24 }}
      aria-hidden
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl ?? undefined}
          alt=""
          className="size-full object-cover"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <Icon />
      )}
    </span>
  );
}

function attentionHref(lang: Locale, item: MemberHomeThreadItem) {
  if (item.kind === 'signal') {
    return getSignalPath(lang, item.spaceSlug, item.slug);
  }
  return getProposalPath(lang, item.spaceSlug, item.slug);
}

export function MemberHomeAttention({
  lang,
  home,
  isLoading = false,
}: {
  lang: Locale;
  home?: MemberIntelligence | null;
  isLoading?: boolean;
}) {
  const t = useTranslations('MemberHome');
  const tTypes = useTranslations('CoherenceTab');
  const tCommon = useTranslations('Common');
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const items = useMemo(() => {
    if (!home) return [];
    if (home.person.slug) bindHomePerson(home.person.slug);
    const choices = readHomeChoices();
    return memberHomeItemsStillWaiting(listMemberHomeAttentionItems(home), {
      passed: choices.passed,
      deferred: choices.deferred,
      settled: choices.settled,
      acted: readHomeActed(),
    });
  }, [home]);

  return (
    <div className="relative min-h-[calc(100dvh-4.5rem)]">
      <div className="member-home-banner" aria-hidden>
        <img
          alt=""
          className="member-home-banner-image"
          src="/brand/strategy-mycelium.png"
        />
        <div className="member-home-banner-veil" />
      </div>
      <div className="relative mx-auto w-full max-w-xl px-4 py-6 md:py-10">
        <Link
          href={`/${lang}/home`}
          className="text-1 text-neutral-11 underline-offset-4 hover:text-foreground hover:underline"
        >
          {tCommon('back')}
        </Link>
        <div className="mt-4 flex items-baseline justify-between gap-3 border border-border bg-background px-4 py-4">
          <h1
            className="text-3"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('waiting')}
          </h1>
          {!isLoading && items.length > 0 ? (
            <p className="text-1 tabular-nums text-neutral-11">
              {items.length}
            </p>
          ) : null}
        </div>
        <div className="mt-4 border border-border bg-background">
          {isLoading ? (
            <ul className="divide-y divide-border" aria-hidden>
              {Array.from({ length: 5 }, (_, index) => (
                <li key={index} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton
                    loading
                    height="32px"
                    width="32px"
                    className="shrink-0 rounded-none bg-foreground/10"
                  />
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <Skeleton
                      loading
                      height="12px"
                      width="70%"
                      className="rounded-none bg-foreground/10"
                    />
                    <Skeleton
                      loading
                      height="12px"
                      width="40%"
                      className="rounded-none bg-foreground/10"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <p className="p-4 text-1 text-neutral-11">{t('noWaiting')}</p>
          ) : (
            <ul>
              {items.map((item) => {
                const typeName = item.category?.trim();
                const typeKey = typeName
                  ? (`types.${typeName}` as 'types.Need')
                  : null;
                const typeLabel =
                  typeKey && tTypes.has(typeKey) ? tTypes(typeKey) : typeName;
                const detail =
                  item.kind === 'signal'
                    ? [typeLabel, item.spaceTitle].filter(Boolean).join(' · ')
                    : [item.spaceTitle, item.documentKind]
                        .filter(Boolean)
                        .join(' · ');
                return (
                  <li
                    key={`${item.kind}:${item.slug}`}
                    className="border-b border-border last:border-b-0"
                  >
                    <Link
                      href={attentionHref(lang, item)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-background-4/70"
                    >
                      <AttentionMark
                        kind={item.kind}
                        iconUrl={resolveSpaceDisplayLogoUrl(
                          item.spaceLogo,
                          logoVariant,
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-1 text-foreground">
                          {item.title}
                        </span>
                        {detail ? (
                          <span className="mt-0.5 block text-1 text-neutral-11">
                            {detail}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
