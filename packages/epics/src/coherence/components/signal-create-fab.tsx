'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PlusIcon } from '@radix-ui/react-icons';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export function SignalCreateFab({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-30', className)}>
      <div className="sticky top-[calc(100%-5.5rem)] flex justify-end px-1 pt-2">
        <Button
          asChild
          colorVariant="accent"
          className="pointer-events-auto h-12 shadow-md"
        >
          <Link href={href} aria-label={t('newSignal')}>
            <PlusIcon />
            <span className="hidden sm:inline">{t('newSignal')}</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
