'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import type { MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  AiPanelChatBar,
  convertFilesToParts,
  type AiPanelDraftAttachment,
} from '../../common/ai-panel';
import { getProposalPath, getSignalPath } from '../../common/get-path-function';
import { celebrate } from './member-home-celebrate';
import { MemberHomeVote } from './member-home-vote';

type MemberHomeChatProps = {
  lang: Locale;
  intelligence: MemberIntelligence;
};

type HomeMessage = UIMessage & {
  metadata?: { homeArrival?: boolean };
};

function messageText(message: HomeMessage) {
  return (message.parts ?? [])
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('\n')
    .trim();
}

export function MemberHomeChat({ lang, intelligence }: MemberHomeChatProps) {
  const t = useTranslations('MemberHome');
  const {
    getAccessToken,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthentication();
  const [input, setInput] = useState('');
  const [drafts, setDrafts] = useState<AiPanelDraftAttachment[]>([]);
  const [dismissedError, setDismissedError] = useState(false);
  const opened = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: async (): Promise<Record<string, string>> => {
          try {
            const token = (await getAccessToken?.()) ?? undefined;
            return token ? { Authorization: `Bearer ${token}` } : {};
          } catch {
            return {};
          }
        },
        body: { memberHome: true, locale: lang },
      }),
    [getAccessToken, lang],
  );

  const { messages, sendMessage, stop, status, error, clearError } = useChat({
    id: 'member-home',
    transport,
  });
  const isStreaming = status === 'streaming' || status === 'submitted';
  const homeMessages = messages as HomeMessage[];

  const send = useCallback(
    async (text: string, hidden = false) => {
      const trimmed = text.trim();
      const files = drafts.map((item) => item.file);
      if (!trimmed && files.length === 0) return;
      setDismissedError(false);
      clearError();
      let token: string | undefined;
      try {
        token = (await getAccessToken?.()) ?? undefined;
      } catch {
        token = undefined;
      }
      const fileParts =
        files.length > 0
          ? await convertFilesToParts(files, { authorizationToken: token })
          : [];
      const textParts = trimmed
        ? [{ type: 'text' as const, text: trimmed }]
        : [];
      await sendMessage(
        {
          role: 'user',
          metadata: hidden ? { homeArrival: true } : undefined,
          parts: [...textParts, ...fileParts],
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: { memberHome: true, locale: lang },
        },
      );
      setInput('');
      setDrafts([]);
    },
    [clearError, drafts, getAccessToken, lang, sendMessage],
  );

  useEffect(() => {
    if (opened.current || isAuthLoading || !isAuthenticated) return;
    opened.current = true;
    void send(t('homeArrival'), true);
  }, [isAuthenticated, isAuthLoading, send, t]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [homeMessages, isStreaming]);

  const lead = intelligence.attention[0] ?? null;
  const leadProposal =
    lead?.kind === 'proposal'
      ? intelligence.proposals.find(
          (proposal) => proposal.slug === lead.targetSlug,
        ) ?? null
      : intelligence.proposals.find(
          (proposal) => proposal.state === 'proposal',
        ) ?? null;
  const leadSignal = lead?.kind === 'signal' ? lead : null;

  const chips = [
    { key: 'useful', ask: t('chipUseful') },
    { key: 'space', ask: t('chipSpace') },
    { key: 'people', ask: t('chipPeople') },
    { key: 'decision', ask: t('chipDecision') },
  ] as const;

  const visibleError = error && !dismissedError;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6"
        aria-label={t('conversation')}
      >
        <div className="mx-auto grid w-full max-w-2xl gap-4">
          {homeMessages.map((message) => {
            if (message.metadata?.homeArrival) return null;
            const text = messageText(message);
            if (!text && message.role !== 'assistant') return null;
            const mine = message.role === 'user';
            return (
              <article
                key={message.id}
                className={cn('flex gap-3', mine && 'flex-row-reverse')}
              >
                {mine ? null : (
                  <img
                    src="/brand/strategy-mycelium.png"
                    alt=""
                    className="mt-0.5 h-8 w-8 shrink-0 object-cover"
                  />
                )}
                <p
                  className={cn(
                    'max-w-[46ch] whitespace-pre-wrap text-2 leading-relaxed',
                    mine ? 'text-foreground' : 'text-neutral-12',
                  )}
                >
                  {text || (isStreaming ? t('thinking') : '')}
                </p>
              </article>
            );
          })}

          {leadProposal ? (
            <section className="border border-border bg-background-2 p-4">
              <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
                {leadProposal.spaceTitle}
              </p>
              <h2
                className="mt-2 text-4"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {leadProposal.title}
              </h2>
              {leadProposal.web3ProposalId != null ? (
                <MemberHomeVote
                  proposalId={leadProposal.web3ProposalId}
                  documentId={leadProposal.id}
                />
              ) : (
                <p className="mt-3 text-2 text-neutral-11">
                  {t('voteNeedsChain')}
                </p>
              )}
              <Button asChild className="mt-3" variant="outline">
                <Link
                  href={
                    leadProposal.slug
                      ? getProposalPath(
                          lang,
                          leadProposal.spaceSlug,
                          leadProposal.slug,
                        )
                      : `/${lang}/dho/${leadProposal.spaceSlug}/agreements`
                  }
                >
                  {t('visitSpace')}
                </Link>
              </Button>
            </section>
          ) : null}

          {leadSignal ? (
            <section className="border border-border bg-background-2 p-4">
              <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
                {leadSignal.spaceTitle}
              </p>
              <h2
                className="mt-2 text-4"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {leadSignal.title}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    celebrate();
                    void send(
                      t('validatedSignal', { title: leadSignal.title }),
                    );
                  }}
                >
                  {t('validate')}
                </Button>
                <Button asChild variant="outline">
                  <Link
                    href={getSignalPath(
                      lang,
                      leadSignal.spaceSlug,
                      leadSignal.targetSlug,
                    )}
                  >
                    {t('viewSignal')}
                  </Link>
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {visibleError ? (
        <div className="mx-4 mb-2 border border-border bg-background-2 px-3 py-2 text-2 md:mx-6">
          <p>{t('threadDropped')}</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              onClick={() => {
                const last = [...homeMessages]
                  .reverse()
                  .find(
                    (message) =>
                      message.role === 'user' && !message.metadata?.homeArrival,
                  );
                if (last) void send(messageText(last));
              }}
            >
              {t('tryAgain')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              onClick={() => {
                setDismissedError(true);
                clearError();
              }}
            >
              {t('dismiss')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="border-t border-border px-3 py-3 md:px-5">
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {chips.map((chip) => (
            <Button
              key={chip.key}
              type="button"
              variant="outline"
              colorVariant="neutral"
              disabled={isStreaming}
              className="shrink-0"
              onClick={() => {
                void send(chip.ask);
              }}
            >
              {chip.ask}
            </Button>
          ))}
        </div>
        <AiPanelChatBar
          value={input}
          onChange={setInput}
          onSend={() => {
            void send(input);
          }}
          onStop={() => stop()}
          isStreaming={isStreaming}
          draftAttachments={drafts}
          onDraftAttachmentsChange={setDrafts}
          placeholder={t('chatPlaceholder')}
          variant="panel"
        />
      </div>
    </div>
  );
}
