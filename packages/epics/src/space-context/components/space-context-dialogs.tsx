'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  officialSectionMarkdown,
  stripMatchingLeadingHeading,
  type SpaceContextSectionKey,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { MemoryProse } from '../../coherence/components/memory-prose';
import {
  patchSpaceContextSectionRequest,
  revalidateSpaceContext,
  setSpaceContextRemovalSuggestedRequest,
  SpaceContextRequestError,
} from '../hooks/use-space-context';

const DIALOG_WIDTH =
  'w-[min(48rem,calc(100vw-var(--sidebar-left-width,0px)-var(--sidebar-right-width,0px)-2rem))]';

/** The whole section, for reading long text without the card's cut-off. */
export function SpaceContextReadDialog({
  section,
  spaceSlug,
  canMutate,
  onClose,
}: {
  section: SpaceContextSectionRecord | null;
  spaceSlug: string;
  canMutate: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('SpaceContext');
  const { getAccessToken } = useAuthentication();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const sectionKey = section?.sectionKey;

  useEffect(() => {
    setMessage(null);
    setActionError(null);
  }, [sectionKey]);

  const canSuggestRemoval =
    canMutate &&
    section != null &&
    section.status !== 'proposed' &&
    section.pendingChange !== 'add';

  const toggleRemoval = async () => {
    if (!section || busy) return;
    const suggested = section.pendingChange !== 'remove';
    setActionError(null);
    setMessage(null);
    setBusy(true);
    try {
      await setSpaceContextRemovalSuggestedRequest({
        spaceSlug,
        sectionKey: section.sectionKey,
        suggested,
        getAccessToken,
      });
      setMessage(
        suggested
          ? t('success.removalSuggested')
          : t('success.removalWithdrawn'),
      );
      await revalidateSpaceContext(spaceSlug);
    } catch {
      setActionError(t('error.change'));
    } finally {
      setBusy(false);
    }
  };

  const body = section
    ? stripMatchingLeadingHeading(
        officialSectionMarkdown(section) ?? section.markdown,
        section.title,
      )
    : '';

  return (
    <Dialog
      open={section != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {section ? (
        <DialogContent className={`${DIALOG_WIDTH} gap-5`}>
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-5 font-semibold">
              {section.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('card.read', { section: section.title })}
            </DialogDescription>
          </DialogHeader>
          {body.trim() ? (
            <MemoryProse
              source={body}
              className="text-2 leading-relaxed text-foreground"
            />
          ) : (
            <p className="text-2 text-neutral-11">{t('card.emptyBody')}</p>
          )}
          {actionError ? (
            <p className="text-2 text-error-11" role="alert">
              {actionError}
            </p>
          ) : message ? (
            <p className="text-2 text-neutral-11" role="status">
              {message}
            </p>
          ) : null}
          {canSuggestRemoval ? (
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                disabled={busy}
                onClick={() => void toggleRemoval()}
              >
                {section.pendingChange === 'remove'
                  ? t('reader.cancelRemoval')
                  : t('reader.suggestRemoval')}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/** Latest saved draft of a section; members can edit and save it here. */
export function SpaceContextDraftDialog({
  open,
  onOpenChange,
  spaceSlug,
  sectionKey,
  sectionTitle,
  markdown,
  canEdit,
  onVoting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  sectionKey: SpaceContextSectionKey;
  sectionTitle: string;
  markdown: string;
  canEdit: boolean;
  onVoting: boolean;
}) {
  const t = useTranslations('SpaceContext');
  const { getAccessToken } = useAuthentication();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(markdown);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const baseMarkdownRef = useRef(markdown);

  useEffect(() => {
    if (open) return;
    setEditing(false);
    setSaveError(null);
    setSaved(false);
  }, [open]);

  useEffect(() => {
    if (editing) return;
    baseMarkdownRef.current = markdown;
    setDraft(markdown);
  }, [editing, markdown]);

  const remoteChanged = editing && markdown !== baseMarkdownRef.current;
  const body = stripMatchingLeadingHeading(markdown, sectionTitle);

  const startEditing = () => {
    baseMarkdownRef.current = markdown;
    setDraft(markdown);
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  };

  const loadLatest = () => {
    baseMarkdownRef.current = markdown;
    setDraft(markdown);
  };

  const save = async () => {
    if (!canEdit || saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      await patchSpaceContextSectionRequest({
        spaceSlug,
        sectionKey,
        markdown: draft,
        getAccessToken,
      });
      setSaved(true);
      setEditing(false);
      try {
        await revalidateSpaceContext(spaceSlug);
      } catch {
        // Refresh must not turn a successful save into a failed one.
      }
    } catch (err) {
      setSaveError(
        err instanceof SpaceContextRequestError && err.code === 'on_voting'
          ? t('error.onVoting')
          : t('error.save'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${DIALOG_WIDTH} gap-5`}>
        <DialogHeader className="pr-8 text-left">
          <DialogDescription className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-11">
            {t('draft.label')}
          </DialogDescription>
          <DialogTitle className="text-5 font-semibold">
            {sectionTitle}
          </DialogTitle>
        </DialogHeader>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={saving}
              rows={14}
              placeholder={t('chat.draftPlaceholder', {
                section: sectionTitle,
              })}
              aria-label={t('draft.label')}
            />
            {remoteChanged ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-1 text-neutral-11">
                <span>{t('chat.draftUpdated')}</span>
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  className="h-7 px-2"
                  onClick={loadLatest}
                >
                  {t('chat.loadLatest')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : body.trim() ? (
          <MemoryProse
            source={body}
            className="text-2 leading-relaxed text-foreground"
          />
        ) : (
          <p className="text-2 text-neutral-11">{t('card.emptyBody')}</p>
        )}

        {onVoting ? (
          <p className="text-1 text-neutral-11">{t('chat.draftLockedHint')}</p>
        ) : null}
        {saveError ? (
          <p className="text-2 text-error-11" role="alert">
            {saveError}
          </p>
        ) : saved ? (
          <p className="text-2 text-success-11" role="status">
            {t('success.saved')}
          </p>
        ) : null}

        {canEdit && !onVoting ? (
          <DialogFooter className="gap-2 sm:space-x-0">
            {editing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setSaveError(null);
                  }}
                >
                  {t('draft.cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? t('chat.saving') : t('chat.saveDraft')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                onClick={startEditing}
              >
                {t('draft.edit')}
              </Button>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
