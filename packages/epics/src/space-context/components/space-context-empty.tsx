'use client';

import { Button } from '@hypha-platform/ui';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function SpaceContextEmpty({
  canMutate,
  onStartMission,
}: {
  canMutate: boolean;
  onStartMission: () => void;
}) {
  const t = useTranslations('SpaceContext');

  return (
    <div className="craft-card flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="craft-icon-box">
        <BookOpen className="craft-icon" strokeWidth={1.25} aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="craft-page-title text-4 font-medium">
          {t('empty.title')}
        </h2>
        <p className="craft-meta">{t('empty.description')}</p>
      </div>
      {canMutate ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={onStartMission}>
            {t('empty.startMission')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
