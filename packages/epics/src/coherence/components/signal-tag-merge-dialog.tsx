'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import {
  findNearDuplicateTags,
  normalizeTagKey,
} from '@hypha-platform/core/client';

type SignalTagMergeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTags: string[];
  onMerge: (fromTag: string, toTag: string) => Promise<void>;
};

export function SignalTagMergeDialog({
  open,
  onOpenChange,
  existingTags,
  onMerge,
}: SignalTagMergeDialogProps) {
  const t = useTranslations('CoherenceTab');
  const [fromTag, setFromTag] = React.useState('');
  const [toTag, setToTag] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const nearDuplicates = React.useMemo(
    () => (fromTag ? findNearDuplicateTags(fromTag, existingTags) : []),
    [existingTags, fromTag],
  );

  React.useEffect(() => {
    if (!open) {
      setFromTag('');
      setToTag('');
      setError(null);
    }
  }, [open]);

  const canSubmit =
    fromTag &&
    toTag &&
    normalizeTagKey(fromTag) !== normalizeTagKey(toTag) &&
    !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('mergeTagsTitle')}</DialogTitle>
          <DialogDescription>{t('mergeTagsDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('mergeTagsFrom')}</span>
            <Select value={fromTag} onValueChange={setFromTag}>
              <SelectTrigger>
                <SelectValue placeholder={t('mergeTagsFromPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {existingTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('mergeTagsTo')}</span>
            <Select value={toTag} onValueChange={setToTag}>
              <SelectTrigger>
                <SelectValue placeholder={t('mergeTagsToPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {existingTags
                  .filter(
                    (tag) => normalizeTagKey(tag) !== normalizeTagKey(fromTag),
                  )
                  .map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          {nearDuplicates.length > 1 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('mergeTagsNearDuplicates', {
                tags: nearDuplicates.join(', '),
              })}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            onClick={() => onOpenChange(false)}
          >
            {t('boardCancelAction')}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onMerge(fromTag, toTag);
                onOpenChange(false);
              } catch (mergeError) {
                setError(
                  mergeError instanceof Error
                    ? mergeError.message
                    : t('mergeTagsFailed'),
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? t('mergeTagsSaving') : t('mergeTagsConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
