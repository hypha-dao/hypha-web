'use client';

import React from 'react';
import {
  usePipelineSavedViews,
  type DealFilters,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type SavedViewsMenuProps = {
  spaceSlug: string;
  filters: DealFilters;
  onApply: (filters: DealFilters) => void;
};

export function SavedViewsMenu({
  spaceSlug,
  filters,
  onApply,
}: SavedViewsMenuProps) {
  const t = useTranslations('Pipeline');
  const { views, createView, deleteView } = usePipelineSavedViews(spaceSlug);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((view) => (
        <div key={view.id} className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onApply(view.filters as DealFilters)}
          >
            {view.name}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => deleteView({ id: view.id })}
            aria-label={t('savedViews.delete')}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        {t('savedViews.save')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('savedViews.saveTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('savedViews.namePlaceholder')}
            />
            <Button
              type="button"
              disabled={!name.trim()}
              onClick={async () => {
                await createView({
                  name: name.trim(),
                  filters: filters as Record<string, unknown>,
                  sort: {},
                });
                setName('');
                setOpen(false);
              }}
            >
              {t('savedViews.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
