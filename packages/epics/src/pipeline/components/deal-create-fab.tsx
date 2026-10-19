'use client';

import { useTranslations } from 'next-intl';
import { PlusIcon } from '@radix-ui/react-icons';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export function DealCreateFab({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const t = useTranslations('Pipeline');

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-30', className)}>
      <div className="sticky top-[calc(100%-5.5rem)] flex justify-end px-1 pt-2">
        <Button
          type="button"
          colorVariant="accent"
          className="pointer-events-auto h-12 shadow-md"
          onClick={onClick}
          aria-label={t('newDeal.create')}
        >
          <PlusIcon />
          <span className="hidden sm:inline">{t('newDeal.create')}</span>
        </Button>
      </div>
    </div>
  );
}
