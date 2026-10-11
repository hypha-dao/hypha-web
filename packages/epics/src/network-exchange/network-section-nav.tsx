'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';

const LINKS = [
  { key: 'navNetwork', href: '' },
  { key: 'navExchange', href: '/exchange' },
  { key: 'navNeeds', href: '/needs' },
  { key: 'navAction', href: '/proof-of-action' },
  { key: 'navImpact', href: '/proof-of-impact' },
  { key: 'navCreate', href: '/create' },
] as const;

export function NetworkSectionNav({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const t = useTranslations('NetworkExchange');
  const base = `/${lang}/network`;

  return (
    <nav className="flex flex-wrap gap-2" aria-label={t('navNetwork')}>
      {LINKS.map((link) => {
        const href = `${base}${link.href}`;
        const active =
          link.href === ''
            ? pathname === base || pathname === `${base}/`
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={link.key}
            href={href}
            className={cn(
              'border px-3 py-1 text-1 uppercase tracking-[0.12em]',
              active
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-neutral-11 hover:text-foreground',
            )}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
