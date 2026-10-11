'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { Skeleton } from '@hypha-platform/ui';
import type { MemberIntelligence } from '@hypha-platform/core/client';

import { getProposalPath } from '../../common/get-path-function';
import { SpaceSwitcherMark } from '../../spaces/components/space-switcher-option';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import './member-home-banner.css';

type NotificationItem = MemberIntelligence['notifications'][number];

function notificationHref(lang: Locale, item: NotificationItem) {
  if (item.kind === 'signal') {
    return `/${lang}/dho/${item.spaceSlug}?signal=${encodeURIComponent(
      item.targetSlug,
    )}`;
  }
  return getProposalPath(lang, item.spaceSlug, item.targetSlug);
}

export function MemberHomeNotifications({
  lang,
  items,
  isLoading = false,
}: {
  lang: Locale;
  items: NotificationItem[];
  isLoading?: boolean;
}) {
  const t = useTranslations('MemberHome');
  const tCommon = useTranslations('Common');
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';

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
            {t('notifications')}
          </h1>
          {!isLoading && items.length > 0 ? (
            <p className="text-1 tabular-nums text-neutral-11">
              {items.length}
            </p>
          ) : null}
        </div>
        <div className="mt-4 border border-border bg-background">
          {isLoading ? (
            <div className="grid gap-3 p-4">
              <Skeleton loading height="16px" width="70%" />
              <Skeleton loading height="16px" width="46%" />
              <Skeleton loading height="16px" width="62%" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-4 text-1 text-neutral-11">{t('noNotifications')}</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-border last:border-b-0"
                >
                  <Link
                    href={notificationHref(lang, item)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-background-4/70"
                  >
                    <SpaceSwitcherMark
                      iconUrl={resolveSpaceDisplayLogoUrl(
                        item.spaceLogo,
                        logoVariant,
                      )}
                      alt={item.spaceTitle}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-1 text-foreground">
                        {item.title}
                      </span>
                      {item.detail ? (
                        <span className="mt-0.5 block truncate text-1 text-neutral-11">
                          {item.detail}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
