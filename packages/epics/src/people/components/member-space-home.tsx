'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import { useFindCoherences, useSpaceBySlug } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { AiPanelChatBar } from '../../common/ai-panel/ai-panel-chat-bar';
import { resolveChatTransportBody } from '../../common/ai-onboarding-context';
import type { StoredOnboardingChatMessage } from '../../common/ai-onboarding-context';
import { signalDetailPath } from '../../coherence/lib/signal-detail-path';
import { MemberHomeBanner } from './member-home-banner';
import { MemberHomeMark } from './member-home-mark';
import { HomeWave } from './member-home-wave';

/** Same width as the home conversation column. */
const SPACE_HOME_COLUMN =
  'mx-auto w-full min-w-0 lg:max-w-[min(75%,75vw,72rem)]';

const SIGNALS_SHOWN = 4;

const HOME_STORAGE_PREFIX = 'hypha:space-home-chat:';

function storageKey(spaceSlug: string) {
  return `${HOME_STORAGE_PREFIX}${spaceSlug.trim()}`;
}

function readSpaceHomeMessages(
  spaceSlug: string,
): StoredOnboardingChatMessage[] | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.sessionStorage.getItem(storageKey(spaceSlug));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (entry): entry is StoredOnboardingChatMessage =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as StoredOnboardingChatMessage).id === 'string' &&
        typeof (entry as StoredOnboardingChatMessage).role === 'string',
    );
  } catch {
    return undefined;
  }
}

function saveSpaceHomeMessages(spaceSlug: string, messages: UIMessage[]) {
  if (typeof window === 'undefined') return;
  const stored: StoredOnboardingChatMessage[] = messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts as StoredOnboardingChatMessage['parts'],
  }));
  try {
    window.sessionStorage.setItem(
      storageKey(spaceSlug),
      JSON.stringify(stored),
    );
  } catch {
    // Ignore quota / private mode failures.
  }
}

function messageText(message: UIMessage): string {
  return (message.parts ?? [])
    .map((part) =>
      part.type === 'text' && 'text' in part && typeof part.text === 'string'
        ? part.text
        : '',
    )
    .join('')
    .trim();
}

/**
 * Member space home. Signals sit above a home-shaped conversation that
 * talks to this space's AI. The network home is a different page.
 */
export function MemberSpaceHome({
  lang,
  spaceSlug,
}: {
  lang: Locale;
  spaceSlug: string;
}) {
  return (
    <MemberSpaceHomeChat key={spaceSlug} lang={lang} spaceSlug={spaceSlug} />
  );
}

function MemberSpaceHomeChat({
  lang,
  spaceSlug,
}: {
  lang: Locale;
  spaceSlug: string;
}) {
  const tCommon = useTranslations('Common');
  const tAi = useTranslations('AiPanel');
  const tHome = useTranslations('MemberHome');
  const { getAccessToken } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { coherences } = useFindCoherences({
    spaceSlug,
    includeArchived: false,
    orderBy: 'mostrecent',
  });
  const signals = (coherences ?? [])
    .filter((signal) => signal.slug && signal.title?.trim())
    .slice(0, SIGNALS_SHOWN);
  const spaceTitle = space?.title?.trim() || spaceSlug;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: async (): Promise<Record<string, string>> => {
          let token: string | undefined;
          try {
            token = (await getAccessToken?.()) ?? undefined;
          } catch {
            token = undefined;
          }
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: {},
      }),
    [getAccessToken],
  );

  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    clearError,
    setMessages,
  } = useChat({
    id: `space-home-${spaceSlug}`,
    transport,
  });

  const [input, setInput] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);
  const isStreaming = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    hydrated.current = false;
    const stored = readSpaceHomeMessages(spaceSlug);
    if (stored?.length) {
      setMessages(
        stored.map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts ?? [],
        })) as UIMessage[],
      );
    }
    hydrated.current = true;
  }, [setMessages, spaceSlug]);

  useEffect(() => {
    if (!hydrated.current || isStreaming) return;
    if (messages.length === 0) {
      const stored = readSpaceHomeMessages(spaceSlug);
      if (stored && stored.length > 0) return;
    }
    saveSpaceHomeMessages(spaceSlug, messages);
  }, [isStreaming, messages, spaceSlug]);

  const messageCount = messages.length;
  useEffect(() => {
    if (messageCount === 0) return;
    const last = scroller.current?.lastElementChild;
    if (!(last instanceof HTMLElement)) return;
    last.scrollIntoView({ block: 'nearest' });
  }, [messageCount]);

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    clearError();
    let token: string | undefined;
    try {
      token = (await getAccessToken?.()) ?? undefined;
    } catch {
      token = undefined;
    }
    const { body } = resolveChatTransportBody({
      spaceSlug,
      activeSpaceTitle: spaceTitle,
      isOnboardingPath: false,
      locale: lang,
    });
    await sendMessage(
      { role: 'user', parts: [{ type: 'text', text }] },
      {
        body,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
  };

  return (
    <div className="relative isolate -mx-4 min-h-[calc(100svh-var(--menu-top-height,4.5rem)-var(--mobile-tab-offset,6rem))] sm:-mx-5 xl:min-h-[calc(100svh-var(--menu-top-height,4.5rem))]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <MemberHomeBanner />
      </div>
      <div
        className={cn(
          SPACE_HOME_COLUMN,
          'relative z-[1] flex min-h-[inherit] flex-col',
        )}
      >
        <section
          className="shrink-0 px-5 pt-4 md:px-4"
          aria-label={tCommon('Signals')}
        >
          <h2
            className="text-3"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            <Link
              href={`/${lang}/dho/${spaceSlug}/coherence`}
              className="text-foreground"
            >
              {tCommon('Signals')}
            </Link>
          </h2>
          {signals.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {signals.map((signal) => (
                <li key={signal.slug}>
                  <Link
                    href={signalDetailPath(lang, spaceSlug, signal.slug ?? '')}
                    className="block truncate text-2 text-foreground underline-offset-4 hover:underline"
                  >
                    {signal.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="flex shrink-0 items-center gap-3 px-5 pt-4 md:px-4">
          <MemberHomeMark className="h-6 w-6" />
          <h1
            className="min-w-0 flex-1 truncate text-7"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {spaceTitle}
          </h1>
        </div>

        <div className="w-full flex-1" aria-label={tHome('conversation')}>
          <div ref={scroller} className="grid gap-4 px-5 py-4 md:px-4">
            {messages.length === 0 ? (
              <article className="flex items-start gap-3">
                <MemberHomeMark className="mt-0.5 h-8 w-8 shrink-0" />
                <p className="text-2 leading-relaxed text-foreground">
                  {tAi('welcome')}
                </p>
              </article>
            ) : null}
            {messages.map((message, index) => {
              const text = messageText(message);
              const mine = message.role === 'user';
              const streamingThis =
                isStreaming && index === messages.length - 1 && !mine;
              if (!text && !streamingThis) return null;
              return (
                <article
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    mine ? 'justify-end' : 'items-start justify-start',
                  )}
                >
                  {mine ? null : (
                    <MemberHomeMark className="mt-0.5 h-8 w-8 shrink-0" />
                  )}
                  {text ? (
                    <p
                      className={cn(
                        'max-w-[85%] text-2 leading-relaxed whitespace-pre-wrap text-foreground',
                        mine && 'text-right',
                      )}
                    >
                      {text}
                    </p>
                  ) : (
                    <div
                      className="grid min-w-0 flex-1 gap-2 pt-1"
                      aria-busy="true"
                    >
                      <HomeWave className="h-3 w-11/12" delayMs={40} />
                      <HomeWave className="h-3 w-4/5" delayMs={90} />
                    </div>
                  )}
                </article>
              );
            })}
            {error ? (
              <div
                className="border border-border bg-background px-3 py-2 text-2"
                role="alert"
              >
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  onClick={() => clearError()}
                >
                  {tCommon('errorTryAgain')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-[var(--mobile-tab-offset,6rem)] z-[1] shrink-0 bg-background/80 px-5 pt-2 pb-3 backdrop-blur-sm md:px-4 xl:bottom-0">
          <div className="border border-border bg-background">
            <AiPanelChatBar
              value={input}
              onChange={setInput}
              onSend={() => {
                void send();
              }}
              onStop={() => stop()}
              isStreaming={isStreaming}
              placeholder={tAi('placeholder')}
              variant="panel"
              topRule={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
