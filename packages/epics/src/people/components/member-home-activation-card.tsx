'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { MemberExpiringSpace } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

export function MemberHomeActivationCard({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: readonly MemberExpiringSpace[];
}) {
  const t = useTranslations('MemberHome');
  if (spaces.length === 0) return null;

  return (
    <section className="grid gap-3 border border-border p-4">
      {spaces.map((space) => (
        <div
          key={space.slug}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-2">{space.title}</p>
            <p className="text-1 text-neutral-11">
              {t('spaceDaysLeft', { count: space.daysLeft })}
            </p>
          </div>
          <Link
            href={`/${lang}/my-wallet/actions/activate-spaces?space=${space.web3SpaceId}`}
            className="inline-flex h-10 items-center border border-foreground bg-foreground px-3 text-1 tracking-[0.12em] text-background uppercase"
          >
            {t('activateWithHypha')}
          </Link>
        </div>
      ))}
    </section>
  );
}
