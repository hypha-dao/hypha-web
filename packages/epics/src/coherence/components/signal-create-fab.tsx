'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PlusIcon } from '@radix-ui/react-icons';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useMainColumnScrollY } from '../../common/main-column-scroll';

export function SignalCreateFab({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');
  const scrollY = useMainColumnScrollY();
  const visible = scrollY > 160;

  if (!visible) return null;

  return (
    <Button
      asChild
      colorVariant="accent"
      className={cn('fixed bottom-6 right-6 z-40 h-12 shadow-md', className)}
    >
      <Link href={href} aria-label={t('newSignal')}>
        <PlusIcon />
        <span className="hidden sm:inline">{t('newSignal')}</span>
      </Link>
    </Button>
  );
}
