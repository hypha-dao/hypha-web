'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  headingForSectionKey,
  SPACE_CONTEXT_SPECIALISTS,
  type SpaceContextSectionKey,
} from '@hypha-platform/core/client';
import { Button, Input, Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Send, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MemoryProse } from '../../coherence/components/memory-prose';
import { SpaceContextStatusChip } from './space-context-status-chip';
import {
  appendSpaceContextMessageRequest,
  patchSpaceContextSectionRequest,
  useSpaceContextSection,
} from '../hooks/use-space-context';

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const hydratedKey = useRef<string | null>(null);
  const persistedAssistantIds = useRef(new Set<string>());
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

  useEffect(() => {
    if (!detail) return;
    const hydrateId = `${sectionKey}:${detail.messages.length}:${detail.section.updatedAt}`;
    if (hydratedKey.current === hydrateId) return;
    hydratedKey.current = hydrateId;
    setDraft(detail.section.markdown);
    setMessages(
      detail.messages.map((message) => ({
        id: `ctx-${message.id}`,
        role: message.role,
        parts: [{ type: 'text' as const, text: message.content }],
      })),
    );
  }, [detail, sectionKey, setMessages]);

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  const isStreaming = status === 'streaming' || status === 'submitted';
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant');

  useEffect(() => {
    if (!lastAssistant || isStreaming) return;
    const text = textFromMessage(lastAssistant as ChatUIMessage);
    if (!text || persistedAssistantIds.current.has(lastAssistant.id)) return;
    persistedAssistantIds.current.add(lastAssistant.id);
    void appendSpaceContextMessageRequest({
      spaceSlug,
      sectionKey,
      role: 'assistant',
      content: text,
      agentKey: specialist.agentKey,
      getAccessToken,
    }).then(() => refresh());
  }, [
    getAccessToken,
    isStreaming,
    lastAssistant,
    refresh,
    sectionKey,
    spaceSlug,
    specialist.agentKey,
  ]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !canMutate) return;
    await appendSpaceContextMessageRequest({
      spaceSlug,
      sectionKey,
      role: 'user',
      content: trimmed,
      getAccessToken,
    });
    await sendMessage({ text: trimmed });
  };

  const handleSaveDraft = async () => {
    if (!canMutate || saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      await patchSpaceContextSectionRequest({
        spaceSlug,
        sectionKey,
        markdown: draft,
        getAccessToken,
      });
      await refresh();
      await onDraftSaved?.();
      setSavedFlash(true);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2500);
    } catch {
      setSaveError(t('error.save'));
    } finally {
      setSaving(false);
    }
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
                disabled={saving}
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
            onChange={(event) => setDraft(event.target.value)}
            disabled={!canMutate || detail?.section.status === 'proposed'}
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

        {canMutate && detail?.section.status !== 'proposed' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!draft.trim() || saving}
              onClick={() => onPropose([sectionKey])}
            >
              {t('chat.propose')}
            </Button>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              disabled={saving}
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
  onSend: (text: string) => Promise<void>;
}) {
  const t = useTranslations('SpaceContext');
  const [value, setValue] = useState('');

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value;
        setValue('');
        void onSend(next);
      }}
    >
      <Input
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('chat.placeholder')}
        className="h-10"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !value.trim()}
        aria-label={t('chat.send')}
      >
        <Send className="size-4" strokeWidth={1.25} />
      </Button>
    </form>
  );
}
