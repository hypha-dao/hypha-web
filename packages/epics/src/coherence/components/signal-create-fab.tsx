'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PlusIcon } from '@radix-ui/react-icons';
import { buttonVariants } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Floating create control. The hit target is the link itself.
 * A full-bleed `pointer-events-none` overlay with a sticky child painted
 * the button in one place and received clicks in another.
 */
export function SignalCreateFab({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');

  return (
    <div className={cn('sticky bottom-6 z-40 flex justify-end', className)}>
      <Link
        href={href}
        aria-label={t('newSignal')}
        className={cn(
          buttonVariants({ colorVariant: 'accent' }),
          'h-12 shadow-md',
        )}
      >
        <PlusIcon />
        <span className="hidden sm:inline">{t('newSignal')}</span>
      </Link>
    </div>
  );
}
