'use client';

import { Button } from '@hypha-platform/ui';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function SpaceContextEmpty({
  canMutate,
  importing,
  onStartMission,
  onImportMemory,
}: {
  canMutate: boolean;
  importing?: boolean;
  onStartMission: () => void;
  onImportMemory: () => void;
}) {
  const t = useTranslations('SpaceContext');

  return (
    <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-border/70 bg-background-2 px-6 py-16 text-center">
      <div className="craft-empty-mark flex size-12 items-center justify-center border border-border/70">
        <BookOpen className="size-5" strokeWidth={1.25} aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="craft-page-title text-4">{t('empty.title')}</h2>
        <p className="text-2 text-neutral-11">{t('empty.description')}</p>
      </div>
      {canMutate ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={onStartMission}>
            {t('empty.startMission')}
          </Button>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            disabled={importing}
            onClick={onImportMemory}
          >
            {importing ? t('empty.importing') : t('empty.importMemory')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
