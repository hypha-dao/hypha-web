'use client';

import React from 'react';
import { usePipelineConfig } from '@hypha-platform/core/client';
import { Button, Input, Separator } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type PipelineLabelSettingsProps = {
  spaceSlug: string;
};

export function PipelineLabelSettings({
  spaceSlug,
}: PipelineLabelSettingsProps) {
  const t = useTranslations('Pipeline');
  const {
    pageTitle,
    itemSingular,
    itemPlural,
    isLoading,
    saveConfig,
    isSaving,
  } = usePipelineConfig(spaceSlug);
  const [titleDraft, setTitleDraft] = React.useState(pageTitle);
  const [singularDraft, setSingularDraft] = React.useState(itemSingular);
  const [pluralDraft, setPluralDraft] = React.useState(itemPlural);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const hasLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasLoadedRef.current || isLoading) return;
    hasLoadedRef.current = true;
    setTitleDraft(pageTitle);
    setSingularDraft(itemSingular);
    setPluralDraft(itemPlural);
  }, [pageTitle, itemSingular, itemPlural, isLoading]);

  const save = async () => {
    const pageTitleValue = titleDraft.trim();
    const singular = singularDraft.trim();
    const plural = pluralDraft.trim();
    if (!pageTitleValue || !singular || !plural) {
      setError(t('labels.required'));
      return;
    }
    try {
      await saveConfig({
        pageTitle: pageTitleValue,
        itemSingular: singular,
        itemPlural: plural,
      });
      setSavedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('labels.saveFailed'));
    }
  };

  if (isLoading) {
    return <div className="text-1 text-neutral-11">{t('labels.loading')}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-2 font-medium text-neutral-12">
          {t('labels.title')}
        </h3>
        <p className="mt-1 text-1 text-neutral-11">{t('labels.description')}</p>
      </div>

      <label className="flex flex-col gap-1 text-1 text-neutral-11">
        {t('labels.pageTitle')}
        <Input
          value={titleDraft}
          onChange={(event) => {
            setTitleDraft(event.target.value);
            setSavedAt(null);
          }}
          placeholder={t('labels.pageTitlePlaceholder')}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-1 text-neutral-11">
          {t('labels.itemSingular')}
          <Input
            value={singularDraft}
            onChange={(event) => {
              setSingularDraft(event.target.value);
              setSavedAt(null);
            }}
            placeholder={t('labels.itemSingularPlaceholder')}
          />
        </label>
        <label className="flex flex-col gap-1 text-1 text-neutral-11">
          {t('labels.itemPlural')}
          <Input
            value={pluralDraft}
            onChange={(event) => {
              setPluralDraft(event.target.value);
              setSavedAt(null);
            }}
            placeholder={t('labels.itemPluralPlaceholder')}
          />
        </label>
      </div>

      {error ? (
        <p className="text-1 text-red-11" role="alert">
          {error}
        </p>
      ) : savedAt ? (
        <p className="text-1 text-neutral-11">{t('labels.saved')}</p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving ? t('saving') : t('labels.save')}
        </Button>
      </div>
      <Separator />
    </div>
  );
}
