'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  SPACE_CONTEXT_SECTION_TITLE_MAX,
  type SpaceContextRemovedSection,
  type SpaceContextSectionKey,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  SpaceContextRequestError,
  suggestSpaceContextSectionRequest,
  type SuggestSpaceContextSectionBody,
} from '../hooks/use-space-context';

export function SpaceContextAddSectionDialog({
  open,
  onOpenChange,
  spaceSlug,
  removedSections,
  onSuggested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  removedSections: SpaceContextRemovedSection[];
  onSuggested: (key: SpaceContextSectionKey) => void | Promise<void>;
}) {
  const t = useTranslations('SpaceContext');
  const { getAccessToken } = useAuthentication();
  const titleId = useId();
  const draftId = useId();
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setTitle('');
    setMarkdown('');
    setError(null);
  }, [open]);

  const submit = async (body: SuggestSpaceContextSectionBody) => {
    setError(null);
    setBusy(true);
    try {
      const created = await suggestSpaceContextSectionRequest({
        spaceSlug,
        body,
        getAccessToken,
      });
      onOpenChange(false);
      await onSuggested(created.sectionKey);
    } catch (err) {
      const code = err instanceof SpaceContextRequestError ? err.code : null;
      setError(
        code === 'duplicate_title'
          ? t('addSection.duplicate')
          : code === 'invalid_title'
          ? t('addSection.titleRequired')
          : t('addSection.failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    void submit({
      title,
      ...(markdown.trim() ? { markdown } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <DialogHeader className="text-left">
          <DialogTitle>{t('addSection.title')}</DialogTitle>
          <DialogDescription>{t('addSection.description')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor={titleId}>{t('addSection.nameLabel')}</Label>
            <Input
              id={titleId}
              value={title}
              maxLength={SPACE_CONTEXT_SECTION_TITLE_MAX}
              placeholder={t('addSection.namePlaceholder')}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={draftId}>{t('addSection.draftLabel')}</Label>
            <Textarea
              id={draftId}
              value={markdown}
              rows={5}
              placeholder={t('addSection.draftPlaceholder')}
              onChange={(event) => setMarkdown(event.target.value)}
              disabled={busy}
            />
          </div>
          {error ? (
            <p className="text-2 text-error-11" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:space-x-0">
            <DialogClose asChild>
              <Button type="button" variant="outline" colorVariant="neutral">
                {t('addSection.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? t('addSection.submitting') : t('addSection.submit')}
            </Button>
          </DialogFooter>
        </form>
        {removedSections.length > 0 ? (
          <div className="space-y-2 border-t border-border/70 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-11">
              {t('addSection.restoreLabel')}
            </p>
            <ul className="divide-y divide-border/70 border border-border/70">
              {removedSections.map((removed) => (
                <li
                  key={removed.sectionKey}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-2">
                    {removed.title}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    className="h-8 shrink-0 px-2"
                    disabled={busy}
                    onClick={() =>
                      void submit({ restoreSectionKey: removed.sectionKey })
                    }
                  >
                    {t('addSection.restore')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
