'use client';

import { Button } from '@hypha-platform/ui';
import { Kanban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SpaceEmptyCard } from '../../common/space-empty-card';

export function PipelineEmpty({
  items,
  onCreate,
}: {
  items: string;
  onCreate?: () => void;
}) {
  const t = useTranslations('Pipeline');

  return (
    <SpaceEmptyCard
      icon={Kanban}
      title={t('empty.title', { items })}
      description={t('empty.description')}
      action={
        onCreate ? (
          <Button type="button" onClick={onCreate}>
            {t('newDeal.create')}
          </Button>
        ) : null
      }
    />
  );
}
