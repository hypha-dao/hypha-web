'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_SIZE_LABEL,
  headingForSectionKey,
  SPACE_CONTEXT_SPECIALISTS,
  uploadChatAttachmentFile,
  type SpaceContextSectionKey,
} from '@hypha-platform/core/client';
import { Button, Input, Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { FileIcon, Paperclip, Send, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MemoryProse } from '../../coherence/components/memory-prose';
import { SpaceContextStatusChip } from './space-context-status-chip';
import {
  appendSpaceContextMessageRequest,
  patchSpaceContextSectionRequest,
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

type ChatUIMessage = {
  id: string;
  role: string;
  parts?: Array<{ type?: string; text?: string }>;
};

function textFromMessage(message: ChatUIMessage): string {
  return (message.parts ?? [])
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function snapshotCoversChat(
  snapshot: Array<{ content: string }>,
  chat: ChatUIMessage[],
): boolean {
  const snapshotTexts = snapshot.map((message) => message.content.trim());
  return chat.every((message) => {
    const text = textFromMessage(message);
    if (!text) return true;
    return snapshotTexts.includes(text);
  });
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
  const locale = useLocale();
  const { getAccessToken } = useAuthentication();
  const { detail, isLoading, error, refresh } = useSpaceContextSection(
    spaceSlug,
    sectionKey,
  );
  const specialist = SPACE_CONTEXT_SPECIALISTS[sectionKey];
  const [draft, setDraft] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const hydratedKey = useRef<string | null>(null);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: async (): Promise<Record<string, string>> => {
          try {
            const token = await getAccessToken?.();
            return token ? { Authorization: `Bearer ${token}` } : {};
          } catch {
            return {};
          }
        },
        body: {
          spaceSlug,
          activeSpaceTitle: spaceTitle,
          locale,
          spaceContext: { sectionKey },
        },
      }),
    [getAccessToken, locale, sectionKey, spaceSlug, spaceTitle],
  );

  const { messages, sendMessage, setMessages, status } = useChat({
    id: `space-context-${spaceSlug}-${sectionKey}`,
    transport,
  });
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const prevStatusRef = useRef(status);

  useEffect(() => {
    setDraftDirty(false);
  }, [sectionKey]);

  useEffect(() => {
    const wasActive =
      prevStatusRef.current === 'streaming' ||
      prevStatusRef.current === 'submitted';
    prevStatusRef.current = status;
    const isActive = status === 'streaming' || status === 'submitted';
    if (wasActive && !isActive) {
      void refresh();
    }
  }, [refresh, status]);

  useEffect(() => {
    if (!detail) return;
    const isActiveResponse = status === 'streaming' || status === 'submitted';
    if (isActiveResponse) return;
    const previousSection = hydratedKey.current?.split(':')[0];
    const sectionChanged = previousSection !== sectionKey;
    if (
      !sectionChanged &&
      !snapshotCoversChat(detail.messages, messagesRef.current)
    ) {
      return;
    }
    const hydrateId = `${sectionKey}:${detail.messages.length}:${detail.section.updatedAt}`;
    if (hydratedKey.current === hydrateId) return;
    hydratedKey.current = hydrateId;
    if (!draftDirty || sectionChanged) {
      setDraft(detail.section.markdown);
    }
    setMessages(
      detail.messages.map((message) => ({
        id: `ctx-${message.id}`,
        role: message.role,
        parts: [{ type: 'text' as const, text: message.content }],
      })),
    );
  }, [detail, draftDirty, sectionKey, setMessages, status]);

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleSend = async (text: string, files: File[]) => {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || !canMutate) return;
    const sharedLines: string[] = [];
    if (files.length > 0) {
      const token = (await getAccessToken?.())?.trim();
      if (!token) {
        throw new Error('Authentication is required to upload documents.');
      }
      const uploads = await Promise.all(
        files.map((file) => uploadChatAttachmentFile(file, token)),
      );
      uploads.forEach((upload, index) => {
        const name = files[index]?.name || 'document';
        sharedLines.push(
          `${t('chat.sharedDocument')}: [${markdownLinkLabel(name)}](${
            upload.url
          })`,
        );
      });
    }
    // Uploaded files are stored like Memory attachments; the thread keeps only
    // the name and link so other members see what was shared.
    const content = [trimmed, ...sharedLines].filter(Boolean).join('\n\n');
    await appendSpaceContextMessageRequest({
      spaceSlug,
      sectionKey,
      role: 'user',
      content,
      getAccessToken,
    });
    await sendMessage({ text: content });
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

  return (
    <aside className="flex h-full min-h-[32rem] w-full flex-col border border-border/70 bg-background-2 xl:w-[26rem] xl:shrink-0">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-11">
            {t('chat.title')}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="truncate text-3 font-medium">
              {headingForSectionKey(sectionKey)}
            </h2>
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

      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2">
        <span className="size-2 rounded-full bg-foreground" aria-hidden />
        <p className="text-1 text-neutral-11">
          {t('chat.specialist', { role: specialist.role })}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : error ? (
          <p className="text-2 text-error-11">{t('chat.loadError')}</p>
        ) : messages.length === 0 ? (
          <p className="text-2 text-neutral-11">{t('chat.empty')}</p>
        ) : (
          messages.map((message) => {
            const text = textFromMessage(message as ChatUIMessage);
            if (!text) return null;
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={cn(
                  'border border-border/60 px-3 py-2 text-2',
                  isUser ? 'ml-6 bg-background' : 'mr-6 bg-background-2',
                )}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-11">
                  {isUser ? t('chat.member') : specialist.role}
                </p>
                <MemoryProse source={text} />
              </div>
            );
          })
        )}
        {isStreaming ? (
          <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
            {t('chat.thinking')}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-border/70 px-4 py-3">
        <div className="border border-border/70 bg-background px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              {t('chat.draftLabel')}
            </p>
            {canMutate ? (
              <Button
                type="button"
                variant="ghost"
                colorVariant="neutral"
                className="h-8 px-2"
                disabled={saving || !detail}
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
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setDraftDirty(true);
            }}
            disabled={
              !canMutate || saving || detail?.section.status === 'proposed'
            }
            rows={6}
            className="w-full resize-y bg-transparent text-2 outline-none"
            aria-label={t('chat.draftLabel')}
          />
        </div>
        {saveError ? (
          <p className="text-2 text-error-11">{saveError}</p>
        ) : savedFlash ? (
          <p className="text-2 text-success-11">{t('success.saved')}</p>
        ) : null}

        {canMutate &&
        detail?.section.status !== 'proposed' &&
        detail?.section.status !== 'ratified' ? (
          <div className="flex flex-wrap gap-2">
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

        <ChatComposer
          disabled={!canMutate || isStreaming}
          onSend={handleSend}
        />
      </div>
    </aside>
  );
}

function ChatComposer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string, files: File[]) => Promise<void>;
}) {
  const t = useTranslations('SpaceContext');
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const next = [...files];
    let error: string | null = null;
    for (const file of Array.from(list)) {
      if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
        error = t('chat.attachTooLarge', {
          maxSize: CHAT_ATTACHMENT_MAX_SIZE_LABEL,
        });
        continue;
      }
      if (next.length >= MAX_SHARED_DOCUMENTS) {
        error = t('chat.attachLimit', { max: MAX_SHARED_DOCUMENTS });
        break;
      }
      next.push(file);
    }
    setFiles(next);
    setAttachError(error);
  };

  const canSend = !disabled && !pending && (!!value.trim() || files.length > 0);

  return (
    <div className="space-y-2">
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex max-w-full items-center gap-1 border border-border/70 bg-background px-2 py-1 text-1"
            >
              <FileIcon className="size-3.5 shrink-0" strokeWidth={1.25} />
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="shrink-0 text-neutral-11 hover:text-foreground disabled:opacity-50"
                aria-label={t('chat.attachRemove', { name: file.name })}
                disabled={pending}
                onClick={() =>
                  setFiles((current) => current.filter((_, i) => i !== index))
                }
              >
                <X className="size-3.5" strokeWidth={1.25} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = value.trim();
          const nextFiles = files;
          if (!canSend) return;
          setPending(true);
          setUploading(nextFiles.length > 0);
          setAttachError(null);
          setValue('');
          setFiles([]);
          void onSend(next, nextFiles)
            .catch(() => {
              setValue(next);
              setFiles(nextFiles);
              if (nextFiles.length > 0) setAttachError(t('chat.uploadFailed'));
            })
            .finally(() => {
              setPending(false);
              setUploading(false);
            });
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          multiple
          accept={SHARED_DOCUMENT_ACCEPT}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          size="icon"
          aria-label={t('chat.attach')}
          title={t('chat.attach')}
          disabled={disabled || pending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" strokeWidth={1.25} />
        </Button>
        <Input
          value={value}
          disabled={disabled || pending}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('chat.placeholder')}
          className="h-10"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label={t('chat.send')}
        >
          <Send className="size-4" strokeWidth={1.25} />
        </Button>
      </form>
      {attachError ? (
        <p className="text-1 text-error-11">{attachError}</p>
      ) : null}
      <p className="text-1 text-neutral-11">
        {uploading ? t('chat.uploading') : t('chat.attachHint')}
      </p>
    </div>
  );
}
