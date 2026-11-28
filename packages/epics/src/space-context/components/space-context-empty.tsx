'use client';

import { Button } from '@hypha-platform/ui';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SpaceEmptyCard } from '../../common/space-empty-card';

export function SpaceContextEmpty({
  canMutate,
  onStartMission,
}: {
  canMutate: boolean;
  onStartMission: () => void;
}) {
  const t = useTranslations('SpaceContext');

  return (
    <SpaceEmptyCard
      icon={BookOpen}
      title={t('empty.title')}
      description={t('empty.description')}
      action={
        canMutate ? (
          <Button type="button" onClick={onStartMission}>
            {t('empty.startMission')}
          </Button>
        ) : null
      }
    />
  );
}
