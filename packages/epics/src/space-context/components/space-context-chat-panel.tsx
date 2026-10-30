'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_SIZE_LABEL,
  headingForSectionKey,
  HYPHA_ROOM_TYPES,
  SPACE_CONTEXT_SPECIALISTS,
  uploadChatAttachmentFile,
  useMatrix,
  type SpaceContextSectionKey,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { AtSign, Paperclip, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MatrixDiscussionThread,
  type MatrixDiscussionComposerTools,
} from '../../common/matrix-discussion-thread';
import { SpaceContextStatusChip } from './space-context-status-chip';
import {
  patchSpaceContextSectionRequest,
  storeSpaceContextChatRoomRequest,
  useSpaceContextSection,
} from '../hooks/use-space-context';

const MAX_SHARED_DOCUMENTS = 5;
const SHARED_DOCUMENT_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.md',
  '.markdown',
  '.txt',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/*',
].join(',');

function markdownLinkLabel(name: string): string {
  return name.replace(/[\r\n]+/g, ' ').replace(/[\\[\]]/g, '\\$&');
}

export function SpaceContextChatPanel({
  spaceSlug,
  spaceTitle,
  sectionKey,
  canMutate,
  onClose,
  onPropose,
  onDraftSaved,
}: {
  spaceSlug: string;
  spaceTitle?: string;
  sectionKey: SpaceContextSectionKey;
  canMutate: boolean;
  onClose: () => void;
  onPropose: (keys: SpaceContextSectionKey[]) => void;
  onDraftSaved?: () => void | Promise<void>;
}) {
  const t = useTranslations('SpaceContext');
  const { getAccessToken } = useAuthentication();
  const { isMatrixAvailable } = useMatrix();
  const { detail, isLoading, error, refresh } = useSpaceContextSection(
    spaceSlug,
    sectionKey,
  );
  const specialist = SPACE_CONTEXT_SPECIALISTS[sectionKey];
  const sectionTitle = headingForSectionKey(sectionKey);
  const agentName = specialist.agentName;
  const [draft, setDraft] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const hydratedSectionRef = useRef<SpaceContextSectionKey | null>(null);
  const baseMarkdownRef = useRef('');
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remoteMarkdown = detail?.section.markdown ?? '';
  const remoteChanged =
    draftDirty && !!detail && remoteMarkdown !== baseMarkdownRef.current;

  useEffect(() => {
    setDraftDirty(false);
    setSaveError(null);
  }, [sectionKey]);

  useEffect(() => {
    if (!detail || detail.section.sectionKey !== sectionKey) return;
    const sectionChanged = hydratedSectionRef.current !== sectionKey;
    if (!sectionChanged && draftDirty) return;
    hydratedSectionRef.current = sectionKey;
    baseMarkdownRef.current = detail.section.markdown;
    setDraft(detail.section.markdown);
  }, [detail, draftDirty, sectionKey]);

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  const loadLatestDraft = () => {
    baseMarkdownRef.current = remoteMarkdown;
    setDraft(remoteMarkdown);
    setDraftDirty(false);
  };

  const handleSaveDraft = async () => {
    if (
      !detail ||
      !canMutate ||
      saving ||
      detail.section.status === 'proposed'
    ) {
      return false;
    }
    setSaveError(null);
    setSaving(true);
    try {
      await patchSpaceContextSectionRequest({
        spaceSlug,
        sectionKey,
        markdown: draft,
        getAccessToken,
      });
      baseMarkdownRef.current = draft;
      setDraftDirty(false);
      setSavedFlash(true);
      setSaving(false);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2500);
      try {
        await refresh();
      } catch {
        // Refresh must not turn a successful PATCH into a failed save.
      }
      try {
        await onDraftSaved?.();
      } catch {
        // Post-save callbacks must not turn a successful PATCH into a failed save.
      }
      return true;
    } catch {
      setSaveError(t('error.save'));
      setSaving(false);
      return false;
    }
  };

  const handlePropose = async () => {
    const saved = await handleSaveDraft();
    if (saved) onPropose([sectionKey]);
  };

  const persistRoomId = useCallback(
    (roomId: string) =>
      storeSpaceContextChatRoomRequest({
        spaceSlug,
        sectionKey,
        chatRoomId: roomId,
        getAccessToken,
      }),
    [getAccessToken, sectionKey, spaceSlug],
  );

  const agent = useMemo(
    () => ({
      label: agentName,
      skills: (['review', 'refine', 'draft', 'fromSource'] as const).map(
        (id) => ({
          id,
          prompt: t(`chat.skills.${id}`, { section: sectionTitle }),
        }),
      ),
    }),
    [agentName, sectionTitle, t],
  );
  const agentContext = useMemo(
    () => ({ kind: 'space_context' as const, sectionKey }),
    [sectionKey],
  );

  const handleAgentMessage = useCallback(() => {
    void refresh();
  }, [refresh]);

  const draftLocked =
    !canMutate || saving || detail?.section.status === 'proposed';

  return (
    <aside className="flex h-full min-h-[40rem] w-full flex-col border border-border/70 bg-background-2 xl:w-[28rem] xl:shrink-0">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-11">
            {t('chat.title')}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="truncate text-3 font-medium">{sectionTitle}</h2>
            {detail ? (
              <SpaceContextStatusChip status={detail.section.status} />
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          size="icon"
          aria-label={t('chat.close')}
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={1.25} />
        </Button>
      </header>

      <div className="flex items-start gap-3 border-b border-border/70 px-4 py-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center bg-foreground text-[11px] font-semibold text-background"
          aria-hidden
        >
          {specialist.avatarLabel}
        </span>
        <div className="min-w-0">
          <p className="text-2 font-medium">
            {t('chat.agent', { agent: agentName, section: sectionTitle })}
          </p>
          <p className="text-1 text-neutral-11">
            {t('chat.agentHint', { agent: agentName })}
          </p>
        </div>
      </div>

      <div className="space-y-2 border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
            {t('chat.draftLabel')}
          </p>
          {canMutate ? (
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              className="h-8 px-2"
              disabled={draftLocked || !detail}
              onClick={() => void handleSaveDraft()}
            >
              {saving
                ? t('chat.saving')
                : savedFlash
                ? t('chat.saved')
                : t('chat.saveDraft')}
            </Button>
          ) : null}
        </div>
        {canMutate ? (
          <p className="text-1 text-neutral-11">
            {t('chat.draftHint', { section: sectionTitle })}
          </p>
        ) : null}
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setDraftDirty(true);
          }}
          disabled={draftLocked}
          rows={6}
          placeholder={t('chat.draftPlaceholder', { section: sectionTitle })}
          className="w-full resize-y border border-border/70 bg-background px-3 py-2 text-2 outline-none"
          aria-label={t('chat.draftLabel')}
        />
        {remoteChanged ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-1 text-neutral-11">
            <span>{t('chat.draftUpdated')}</span>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="h-7 px-2"
              onClick={loadLatestDraft}
            >
              {t('chat.loadLatest')}
            </Button>
          </div>
        ) : null}
        {saveError ? (
          <p className="text-2 text-error-11">{saveError}</p>
        ) : savedFlash ? (
          <p className="text-2 text-success-11">{t('success.saved')}</p>
        ) : null}
        {canMutate &&
        detail?.section.status !== 'proposed' &&
        detail?.section.status !== 'ratified' ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              disabled={!detail || !draft.trim() || saving}
              onClick={() => void handlePropose()}
            >
              {t('chat.propose')}
            </Button>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              disabled={saving || !detail}
              onClick={() => void handleSaveDraft()}
            >
              {saving ? t('chat.saving') : t('chat.keepDrafting')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
        {error ? (
          <p className="text-2 text-error-11">{t('chat.loadError')}</p>
        ) : !canMutate ? (
          <p className="text-2 text-neutral-11">{t('chat.membersOnly')}</p>
        ) : !isMatrixAvailable ? (
          <p className="text-2 text-neutral-11">{t('chat.signInHint')}</p>
        ) : isLoading || !detail ? (
          <p className="text-2 text-neutral-11">{t('chat.connecting')}</p>
        ) : (
          <MatrixDiscussionThread
            key={`${spaceSlug}:${sectionKey}`}
            threadKey={`${spaceSlug}:${sectionKey}`}
            initialChatRoomId={detail.section.chatRoomId}
            chatRoomResolved
            roomTitle={t('chat.roomTitle', {
              section: sectionTitle,
              space: spaceTitle?.trim() || spaceSlug,
            })}
            roomType={HYPHA_ROOM_TYPES.context}
            persistRoomId={persistRoomId}
            spaceSlug={spaceSlug}
            agent={agent}
            agentContext={agentContext}
            onAgentMessage={handleAgentMessage}
            placeholder={t('chat.placeholder', { agent: agentName })}
            connectingLabel={t('chat.connecting')}
            unavailableLabel={t('chat.unavailable')}
            logLabel="SpaceContextChatPanel"
            messagesClassName="flex min-h-[14rem] flex-1 flex-col"
            emptyHint={
              <p className="text-2 text-neutral-11">
                {t('chat.empty', { section: sectionTitle, agent: agentName })}
              </p>
            }
            renderComposerTools={(tools) => (
              <ComposerTools
                {...tools}
                agentName={agentName}
                getAccessToken={getAccessToken}
              />
            )}
          />
        )}
      </div>
    </aside>
  );
}

function ComposerTools({
  appendToComposer,
  mentionAgent,
  composerLocked,
  agentName,
  getAccessToken,
}: MatrixDiscussionComposerTools & {
  agentName: string;
  getAccessToken?: () => Promise<string | null | undefined>;
}) {
  const t = useTranslations('SpaceContext');
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const tooLarge = files.some(
      (file) => file.size > CHAT_ATTACHMENT_MAX_BYTES,
    );
    const accepted = files
      .filter((file) => file.size <= CHAT_ATTACHMENT_MAX_BYTES)
      .slice(0, MAX_SHARED_DOCUMENTS);
    setAttachError(
      tooLarge
        ? t('chat.attachTooLarge', { maxSize: CHAT_ATTACHMENT_MAX_SIZE_LABEL })
        : files.length > MAX_SHARED_DOCUMENTS
        ? t('chat.attachLimit', { max: MAX_SHARED_DOCUMENTS })
        : null,
    );
    if (accepted.length === 0) return;
    setUploading(true);
    try {
      const token = (await getAccessToken?.())?.trim();
      if (!token) throw new Error('Authentication is required.');
      const uploads = await Promise.all(
        accepted.map((file) => uploadChatAttachmentFile(file, token)),
      );
      // The thread keeps only the name and link; the agent reads the file
      // from that link when someone asks it to.
      appendToComposer(
        uploads
          .map(
            (upload, index) =>
              `${t('chat.sharedDocument')}: [${markdownLinkLabel(
                accepted[index]?.name || 'document',
              )}](${upload.url})`,
          )
          .join('\n'),
      );
    } catch {
      setAttachError(t('chat.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          multiple
          accept={SHARED_DOCUMENT_ACCEPT}
          onChange={(event) => {
            void uploadFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          className="h-8 gap-1.5 px-2"
          disabled={composerLocked || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-3.5" strokeWidth={1.25} />
          {uploading ? t('chat.uploading') : t('chat.attach')}
        </Button>
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          className="h-8 gap-1.5 px-2"
          disabled={composerLocked}
          onClick={mentionAgent}
        >
          <AtSign className="size-3.5" strokeWidth={1.25} />
          {t('chat.askAgent', { agent: agentName })}
        </Button>
      </div>
      {attachError ? (
        <p className="text-1 text-error-11">{attachError}</p>
      ) : (
        <p className="text-1 text-neutral-11">
          {t('chat.attachHint', { agent: agentName })}
        </p>
      )}
    </div>
  );
}
