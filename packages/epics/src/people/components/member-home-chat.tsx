'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  listMemberHomeThreadItems,
  memberHomeThreadItemForMessage,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  AiPanelChatBar,
  OnboardingDiscoveryModeToggle,
  OnboardingVoiceInterviewBar,
  convertFilesToParts,
  type AiPanelDraftAttachment,
} from '../../common/ai-panel';
import {
  loadSpaceDiscoveryMode,
  saveSpaceDiscoveryMode,
} from '../../common/ai-panel-discovery-mode';
import type { OnboardingDiscoveryMode } from '../../common/onboarding-discovery-mode';
import { buildRecentTranscriptSummaryFromChatMessages } from '../../common/onboarding-voice-transcript-bridge';
import { buildSpaceAdvisorVoiceSessionContext } from '../../common/space-voice-session-context';
import { useOnboardingVoiceDiscovery } from '../../common/use-onboarding-voice-discovery';
import { MEMBER_HOME_ASK_EVENT } from './member-home-ask';
import { MemberHomeMark } from './member-home-mark';
import { MemberHomeThreadCard } from './member-home-thread-card';
import type { MemberHomeOpenChat } from './member-home-people';

/** Reserved discovery-mode key. Home must not share a space's voice preference. */
const HOME_VOICE_PREFERENCE_KEY = '__member-home__';

type MemberHomeChatProps = {
  lang: Locale;
  intelligence: MemberIntelligence;
  onChatPerson: MemberHomeOpenChat;
  onCallPerson: MemberHomeOpenChat;
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

export function MemberHomeChat({
  lang,
  intelligence,
  onChatPerson,
  onCallPerson,
}: MemberHomeChatProps) {
  const t = useTranslations('MemberHome');
  const {
    getAccessToken,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthentication();
  const [input, setInput] = useState('');
  const [drafts, setDrafts] = useState<AiPanelDraftAttachment[]>([]);
  const [dismissedError, setDismissedError] = useState(false);
  const [discoveryMode, setDiscoveryMode] =
    useState<OnboardingDiscoveryMode>('chat');
  const [discoveryModeReady, setDiscoveryModeReady] = useState(false);
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
    async (text: string, hidden = false, includeDrafts = true) => {
      const trimmed = text.trim();
      const files = includeDrafts ? drafts.map((item) => item.file) : [];
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
    const onAsk = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (!text?.trim()) return;
      void send(text);
    };
    window.addEventListener(MEMBER_HOME_ASK_EVENT, onAsk);
    return () => window.removeEventListener(MEMBER_HOME_ASK_EVENT, onAsk);
  }, [send]);

  useEffect(() => {
    setDiscoveryMode(loadSpaceDiscoveryMode(HOME_VOICE_PREFERENCE_KEY));
    setDiscoveryModeReady(true);
  }, []);

  const isVoiceInterview = discoveryMode === 'voice_interview';

  const lastAssistantText = useMemo(() => {
    for (let i = homeMessages.length - 1; i >= 0; i -= 1) {
      const message = homeMessages[i];
      if (!message || message.role !== 'assistant') continue;
      const text = messageText(message);
      if (text) return text;
    }
    return '';
  }, [homeMessages]);

  const handleVoiceTranscriptSend = useCallback(
    async (text: string) => {
      const normalized = text.trim();
      if (!normalized || isStreaming) return 'skipped' as const;
      try {
        await send(normalized, false, false);
        return 'sent' as const;
      } catch {
        return 'failed' as const;
      }
    },
    [isStreaming, send],
  );

  const recentTranscriptSummary = useMemo(
    () =>
      buildRecentTranscriptSummaryFromChatMessages(
        homeMessages.filter((message) => !message.metadata?.homeArrival),
      ),
    [homeMessages],
  );

  const voiceSessionContext = useMemo(() => {
    if (!isVoiceInterview) return undefined;
    const spaceSlug = intelligence.chatSpaceSlug?.trim();
    if (!spaceSlug) return undefined;
    return buildSpaceAdvisorVoiceSessionContext({
      spaceSlug,
      locale: lang,
    });
  }, [intelligence.chatSpaceSlug, isVoiceInterview, lang]);

  const voiceInterview = useOnboardingVoiceDiscovery({
    enabled: isVoiceInterview && !isAuthLoading && isAuthenticated,
    isStreaming,
    lastAssistantText,
    locale: lang,
    activeSpaceSlug:
      intelligence.chatSpaceSlug?.trim() || HOME_VOICE_PREFERENCE_KEY,
    conversationContext: voiceSessionContext,
    recentTranscriptSummary,
    getAccessToken,
    onStopChat: stop,
    onSendTranscript: handleVoiceTranscriptSend,
  });

  const handleDiscoveryModeChange = useCallback(
    (mode: OnboardingDiscoveryMode) => {
      if (mode === discoveryMode) return;
      if (mode === 'chat') {
        voiceInterview.stopListening();
        voiceInterview.stopSpeaking();
      }
      saveSpaceDiscoveryMode(HOME_VOICE_PREFERENCE_KEY, mode);
      setDiscoveryMode(mode);
    },
    [discoveryMode, voiceInterview.stopListening, voiceInterview.stopSpeaking],
  );

  useEffect(() => {
    if (
      !discoveryModeReady ||
      opened.current ||
      isAuthLoading ||
      !isAuthenticated
    ) {
      return;
    }
    opened.current = true;
    void send(t('homeArrival'), true);
  }, [discoveryModeReady, isAuthenticated, isAuthLoading, send, t]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [homeMessages, isStreaming]);

  const threadItems = useMemo(
    () => listMemberHomeThreadItems(intelligence),
    [intelligence],
  );

  const chips = [
    { key: 'useful', ask: t('chipUseful') },
    { key: 'space', ask: t('chipSpace') },
    { key: 'people', ask: t('chipPeople') },
    { key: 'decision', ask: t('chipDecision') },
  ] as const;

  const visibleError = error && !dismissedError;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6"
        aria-label={t('conversation')}
      >
        <div className="mx-auto grid w-full max-w-2xl gap-4">
          {homeMessages.map((message) => {
            if (message.metadata?.homeArrival) return null;
            const text = messageText(message);
            const threadItem =
              message.role === 'assistant'
                ? memberHomeThreadItemForMessage(threadItems, message)
                : null;
            if (!text && !threadItem) return null;
            const mine = message.role === 'user';
            const proposal =
              threadItem?.kind === 'proposal'
                ? intelligence.proposals.find(
                    (item) => item.slug === threadItem.slug,
                  ) ?? null
                : null;
            return (
              <article
                key={message.id}
                className={cn('flex gap-3', mine && 'flex-row-reverse')}
              >
                {mine ? null : <MemberHomeMark className="mt-0.5 h-8 w-8" />}
                <div className="grid min-w-0 gap-3">
                  {text || (isStreaming && !threadItem) ? (
                    <p
                      className={cn(
                        'max-w-[46ch] whitespace-pre-wrap text-2 leading-relaxed',
                        mine ? 'text-foreground' : 'text-neutral-12',
                      )}
                    >
                      {text || t('thinking')}
                    </p>
                  ) : null}
                  {threadItem ? (
                    <MemberHomeThreadCard
                      lang={lang}
                      item={threadItem}
                      proposal={proposal}
                      onAsk={(text) => {
                        void send(text);
                      }}
                      onReach={(person, mode) =>
                        mode === 'call'
                          ? onCallPerson(person)
                          : onChatPerson(person)
                      }
                    />
                  ) : null}
                </div>
              </article>
            );
          })}
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

      <div className="w-full min-w-0 shrink-0 border-t border-border">
        <div className="mb-2 flex min-w-0 flex-wrap gap-2 px-3 pt-3 md:px-5">
          {chips.map((chip) => (
            <Button
              key={chip.key}
              type="button"
              variant="outline"
              colorVariant="neutral"
              disabled={isStreaming}
              className="h-auto max-w-full min-w-0 shrink-0 whitespace-normal"
              onClick={() => {
                void send(chip.ask);
              }}
            >
              {chip.ask}
            </Button>
          ))}
        </div>
        <div className="flex justify-center px-3 pb-1 pt-1">
          <OnboardingDiscoveryModeToggle
            mode={discoveryMode}
            disabled={isStreaming}
            onChange={handleDiscoveryModeChange}
          />
        </div>
        {isVoiceInterview ? (
          <OnboardingVoiceInterviewBar
            phase={voiceInterview.phase}
            liveTranscript={voiceInterview.liveTranscript}
            voiceError={voiceInterview.voiceError}
            disabled={isStreaming}
            isConnecting={voiceInterview.isConnecting}
            isRealtimeConnected={voiceInterview.isRealtimeConnected}
            transport={voiceInterview.transport}
            realtimeFeatureEnabled={voiceInterview.realtimeFeatureEnabled}
            usingWebSpeechFallback={voiceInterview.usingWebSpeechFallback}
            onToggleListening={voiceInterview.toggleListening}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}
