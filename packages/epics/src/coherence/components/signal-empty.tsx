'use client';

import { Button } from '@hypha-platform/ui';
import { Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SpaceEmptyCard } from '../../common/space-empty-card';

/** Shown wherever a coherence screen has no signals, instead of an empty board. */
export function SignalEmpty({ action }: { action?: ReactNode }) {
  const t = useTranslations('CoherenceTab');

  return (
    <SpaceEmptyCard
      icon={Radio}
      title={t('empty.title')}
      description={t('empty.description')}
      action={action}
    />
  );
}

export function SignalEmptyCreateButton({ href }: { href: string }) {
  const t = useTranslations('CoherenceTab');
  return (
    <Button asChild>
      <Link href={href} scroll={false}>
        {t('newSignal')}
      </Link>
    </Button>
  );
}
