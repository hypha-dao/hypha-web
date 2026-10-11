'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  listMemberHomeThreadItems,
  memberHomeItemMemory,
  mergeMemberHomeMemory,
  memberHomeThreadItemForMessage,
  type MemberHomeThreadItem,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  AiPanelChatBar,
  convertFilesToParts,
  type AiPanelDraftAttachment,
} from '../../common/ai-panel';
import { buildRecentTranscriptSummaryFromChatMessages } from '../../common/onboarding-voice-transcript-bridge';
import {
  buildMemberHomeVoiceSessionContext,
  buildSpaceAdvisorVoiceSessionContext,
} from '../../common/space-voice-session-context';
import { useOnboardingVoiceDiscovery } from '../../common/use-onboarding-voice-discovery';
import { MEMBER_HOME_ASK_EVENT } from './member-home-ask';
import { MemberHomeMark } from './member-home-mark';
import { PersonAvatar } from './person-avatar';
import {
  MemberHomePeopleWidgetCard,
  MemberHomeSendTokensWidget,
  MemberHomeSpacesWidgetCard,
} from './member-home-chat-widgets';
import type { MemberHomeOpenChat } from './member-home-people';

type HomeWidgetKind = 'spaces' | 'people' | 'tokens';

type HomeWidget = {
  id: string;
  kind: HomeWidgetKind;
  /** Render after the message at this 1-based index. */
  after: number;
};

/** Reserved key. Home must not share a space's voice session. */
const HOME_VOICE_PREFERENCE_KEY = '__member-home__';
const HOME_SOUND_KEY = 'hypha-member-home-sound';
const HOME_MIC_KEY = 'hypha-member-home-mic';
const HOME_CHOICES_KEY = 'hypha-member-home-choices';

function scrollParent(node: HTMLElement): HTMLElement | null {
  let current = node.parentElement;
  while (current) {
    const overflow = getComputedStyle(current).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return current;
    current = current.parentElement;
  }
  return null;
}

function readMemberHomeChoices(): {
  passed: string[];
  deferred: string[];
  settled: string[];
} {
  if (typeof window === 'undefined') {
    return { passed: [], deferred: [], settled: [] };
  }
  try {
    const raw = window.localStorage.getItem(HOME_CHOICES_KEY);
    if (!raw) return { passed: [], deferred: [], settled: [] };
    const parsed = JSON.parse(raw) as {
      passed?: unknown;
      deferred?: unknown;
      settled?: unknown;
    };
    const list = (value: unknown) =>
      Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === 'string')
            .slice(0, 80)
        : [];
    return {
      passed: list(parsed.passed),
      deferred: list(parsed.deferred),
      settled: list(parsed.settled),
    };
  } catch {
    return { passed: [], deferred: [], settled: [] };
  }
}

function readHomeSoundOn() {
  try {
    return window.localStorage.getItem(HOME_SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeHomeSoundOn(on: boolean) {
  try {
    window.localStorage.setItem(HOME_SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // The choice still applies for this visit.
  }
}

function readHomeMicOn() {
  try {
    return window.localStorage.getItem(HOME_MIC_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeHomeMicOn(on: boolean) {
  try {
    window.localStorage.setItem(HOME_MIC_KEY, on ? 'on' : 'off');
  } catch {
    // The choice still applies for this visit.
  }
}

type MemberHomeChatProps = {
  lang: Locale;
  intelligence: MemberIntelligence;
  onChatPerson: MemberHomeOpenChat;
  onCallPerson: MemberHomeOpenChat;
  onVideoPerson: MemberHomeOpenChat;
  onFocusItem?: (item: MemberHomeThreadItem | null) => void;
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

/** A decision stays with the member. Drop narration and any ask for their choice. */
function straightforwardHomeText(text: string) {
  const steers = (sentence: string) =>
    /i['’]ll show you|here(?:'|’)s the proposal|here is the proposal|the proposal titled|if you approve|your approval|can you review|do you approve|would you approve|would you like to approve|what would you like to decide|want to take a look|i(?:'’)?ve approved|\bi approved\b|\bi have approved\b|\bi accepted\b|i(?:'’)?ve accepted|\bi voted\b|you can now see the message|think about it|approval is required|to proceed with|how (?:will|would) you vote|let me know if you|^sure[.!]?$/i.test(
      sentence,
    );
  const cleaned = text
    .replace(/\*\*/g, '')
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !steers(sentence))
    .join(' ')
    .trim();
  if (
    cleaned.length === 0 &&
    /approv|what would you like to decide|want to take a look/i.test(text)
  ) {
    return 'You can now decide on the proposal card.';
  }
  return cleaned;
}

export function MemberHomeChat({
  lang,
  intelligence,
  onChatPerson,
  onCallPerson,
  onVideoPerson,
  onFocusItem,
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
  const [soundOn, setSoundOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const [widgets, setWidgets] = useState<HomeWidget[]>([]);
  const opened = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const followThread = useRef(false);

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
        body: () => ({
          memberHome: true,
          locale: lang,
          memberHomeMemory: readMemberHomeChoices(),
        }),
      }),
    [getAccessToken, lang],
  );

  const { messages, sendMessage, stop, status, error, clearError } = useChat({
    id: 'member-home',
    transport,
  });
  const isStreaming = status === 'streaming' || status === 'submitted';
  const homeMessages = messages as HomeMessage[];

  const widgetKindFor = useCallback(
    (text: string): HomeWidgetKind | null => {
      const value = text.trim().toLowerCase();
      if (!value) return null;
      if (value === t('chipSpace').trim().toLowerCase()) return 'spaces';
      if (value === t('chipPeople').trim().toLowerCase()) return 'people';
      if (value === t('chipTokens').trim().toLowerCase()) return 'tokens';
      if (/\bsend\b/.test(value) && /\btoken/.test(value)) return 'tokens';
      return null;
    },
    [t],
  );

  const send = useCallback(
    async (text: string, hidden = false, includeDrafts = true) => {
      const trimmed = text.trim();
      const files = includeDrafts ? drafts.map((item) => item.file) : [];
      if (!trimmed && files.length === 0) return;
      if (!hidden) followThread.current = true;
      if (!hidden && trimmed) {
        const kind = widgetKindFor(trimmed);
        if (kind) {
          setWidgets((current) => [
            ...current,
            {
              id: `${kind}-${Date.now()}`,
              kind,
              after: homeMessages.length + 1,
            },
          ]);
        }
      }
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
          body: {
            memberHome: true,
            locale: lang,
            memberHomeMemory: readMemberHomeChoices(),
          },
        },
      );
      setInput('');
      setDrafts([]);
    },
    [
      clearError,
      drafts,
      getAccessToken,
      homeMessages.length,
      lang,
      sendMessage,
      widgetKindFor,
    ],
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
    setSoundOn(readHomeSoundOn());
    setMicOn(readHomeMicOn());
    setSoundReady(true);
  }, []);

  const lastAssistantText = useMemo(() => {
    for (let i = homeMessages.length - 1; i >= 0; i -= 1) {
      const message = homeMessages[i];
      if (!message || message.role !== 'assistant') continue;
      const text = messageText(message);
      if (text) return straightforwardHomeText(text);
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

  const dialogue = micOn || soundOn;

  const voiceSessionContext = useMemo(() => {
    if (!dialogue) return undefined;
    const spaceSlug = intelligence.chatSpaceSlug?.trim();
    if (spaceSlug) {
      return buildSpaceAdvisorVoiceSessionContext({
        spaceSlug,
        locale: lang,
      });
    }
    return buildMemberHomeVoiceSessionContext({ locale: lang });
  }, [dialogue, intelligence.chatSpaceSlug, lang]);

  const voiceInterview = useOnboardingVoiceDiscovery({
    enabled: soundReady && dialogue && !isAuthLoading && isAuthenticated,
    captureMicrophone: micOn,
    speakReplies: soundOn,
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

  const toggleSound = useCallback(() => {
    setSoundOn((current) => {
      const next = !current;
      if (next) void voiceInterview.startListening();
      else voiceInterview.stopSpeaking();
      writeHomeSoundOn(next);
      return next;
    });
  }, [voiceInterview.startListening, voiceInterview.stopSpeaking]);

  const toggleMic = useCallback(() => {
    setMicOn((current) => {
      const next = !current;
      if (next) void voiceInterview.startListening();
      writeHomeMicOn(next);
      return next;
    });
  }, [voiceInterview.startListening]);

  useEffect(() => {
    if (!soundReady || opened.current || isAuthLoading || !isAuthenticated) {
      return;
    }
    opened.current = true;
    void send(t('homeArrival'), true);
  }, [isAuthenticated, isAuthLoading, send, soundReady, t]);

  useEffect(() => {
    const node = scroller.current;
    const parent = node ? scrollParent(node) : null;
    if (!parent) return;
    const onScroll = () => {
      const slack =
        parent.scrollHeight - parent.scrollTop - parent.clientHeight;
      followThread.current = slack < 160;
    };
    parent.addEventListener('scroll', onScroll, { passive: true });
    return () => parent.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!followThread.current) return;
    threadEnd.current?.scrollIntoView({ block: 'end' });
  }, [homeMessages, isStreaming, widgets]);

  const threadItems = useMemo(
    () => listMemberHomeThreadItems(intelligence),
    [intelligence],
  );
  useEffect(() => {
    const fromMessages = memberHomeItemMemory(threadItems, homeMessages);
    const merged = mergeMemberHomeMemory(fromMessages, readMemberHomeChoices());
    const deferred = [...merged.deferred];
    for (const key of fromMessages.recalled) {
      if (
        !merged.passed.includes(key) &&
        !merged.settled.includes(key) &&
        !deferred.includes(key)
      ) {
        deferred.push(key);
      }
    }
    try {
      window.localStorage.setItem(
        HOME_CHOICES_KEY,
        JSON.stringify({
          passed: merged.passed,
          deferred,
          settled: merged.settled,
        }),
      );
    } catch {
      // The conversation still carries the choice when storage is blocked.
    }
  }, [homeMessages, threadItems]);
  const focusedItem = useMemo(() => {
    for (let index = homeMessages.length - 1; index >= 0; index -= 1) {
      const message = homeMessages[index];
      if (!message || message.role !== 'assistant') continue;
      if (message.metadata?.homeArrival) continue;
      const item = memberHomeThreadItemForMessage(threadItems, message);
      if (item) return item;
    }
    return null;
  }, [homeMessages, threadItems]);
  useEffect(() => {
    onFocusItem?.(focusedItem);
  }, [focusedItem, onFocusItem]);
  const showSensing = useMemo(() => {
    if (!isStreaming) return false;
    for (let i = homeMessages.length - 1; i >= 0; i -= 1) {
      const message = homeMessages[i];
      if (!message || message.metadata?.homeArrival) continue;
      if (message.role !== 'assistant') return true;
      if (messageText(message)) return false;
      return memberHomeThreadItemForMessage(threadItems, message) == null;
    }
    return true;
  }, [homeMessages, isStreaming, threadItems]);

  const chips = [
    { key: 'useful', ask: t('chipUseful') },
    { key: 'space', ask: t('chipSpace') },
    { key: 'people', ask: t('chipPeople') },
    { key: 'decision', ask: t('chipDecision') },
    { key: 'tokens', ask: t('chipTokens') },
  ] as const;

  const renderWidget = (widget: HomeWidget) => {
    if (widget.kind === 'spaces') {
      return (
        <MemberHomeSpacesWidgetCard lang={lang} spaces={intelligence.spaces} />
      );
    }
    if (widget.kind === 'people') {
      return (
        <MemberHomePeopleWidgetCard
          people={intelligence.connections}
          fallbackName={t('fallbackMember')}
          onChat={(person) => {
            void onChatPerson(person);
          }}
          onCall={(person) => {
            void onCallPerson(person);
          }}
          onVideo={(person) => {
            void onVideoPerson(person);
          }}
        />
      );
    }
    return (
      <MemberHomeSendTokensWidget
        personSlug={intelligence.person.slug}
        hasWallet={Boolean(intelligence.wallet.address)}
        people={intelligence.connections}
        spaces={intelligence.spaces}
        fallbackName={t('fallbackMember')}
      />
    );
  };

  const visibleError = error && !dismissedError;

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div
        ref={scroller}
        className="w-full min-w-0 px-4 py-4 md:px-6"
        aria-label={t('conversation')}
      >
        <div className="grid w-full gap-4">
          {homeMessages.map((message, index) => {
            const attached = widgets.filter(
              (widget) => widget.after === index + 1,
            );
            if (message.metadata?.homeArrival && attached.length === 0) {
              return null;
            }
            const rawText = messageText(message).replace(/\*\*/g, '');
            const text =
              message.role === 'assistant'
                ? straightforwardHomeText(rawText)
                : rawText;
            const showMessage = !message.metadata?.homeArrival && Boolean(text);
            if (!showMessage && attached.length === 0) return null;
            const mine = message.role === 'user';
            const memberName =
              [intelligence.person.name, intelligence.person.surname]
                .filter(Boolean)
                .join(' ')
                .trim() ||
              intelligence.person.nickname ||
              t('fallbackMember');
            return (
              <div key={message.id} className="grid gap-4">
                {showMessage ? (
                  <article
                    className={cn(
                      'flex gap-3',
                      mine ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {mine ? (
                      <PersonAvatar
                        avatarSrc={intelligence.person.avatarUrl ?? undefined}
                        userName={memberName}
                        size="md"
                        shape="circle"
                        className="mt-0.5 shrink-0"
                      />
                    ) : (
                      <MemberHomeMark className="mt-0.5 h-8 w-8 shrink-0" />
                    )}
                    <div
                      className={cn(
                        'grid min-w-0 gap-3',
                        mine ? 'max-w-[85%] text-right' : 'flex-1',
                      )}
                    >
                      {text ? (
                        <p
                          className={cn(
                            'text-2 leading-relaxed whitespace-pre-wrap text-foreground',
                            mine && 'text-right',
                          )}
                        >
                          {text}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ) : null}
                {attached.map((widget) => (
                  <article key={widget.id} className="flex gap-3">
                    <MemberHomeMark className="mt-0.5 h-8 w-8" />
                    {renderWidget(widget)}
                  </article>
                ))}
              </div>
            );
          })}
          {widgets
            .filter((widget) => widget.after > homeMessages.length)
            .map((widget) => (
              <article key={widget.id} className="flex gap-3">
                <MemberHomeMark className="mt-0.5 h-8 w-8" />
                {renderWidget(widget)}
              </article>
            ))}
          {showSensing ? (
            <article className="flex gap-3" aria-live="polite">
              <MemberHomeMark className="mt-0.5 h-8 w-8" />
              <p className="text-2 leading-relaxed text-neutral-11">
                {t('thinking')}
              </p>
            </article>
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

      <div
        ref={threadEnd}
        className="w-full min-w-0 shrink-0 border-t border-border pb-3"
      >
        <div className="narrow-scrollbar mb-2 flex min-w-0 flex-nowrap gap-2 overflow-x-auto px-4 pt-3 md:px-6">
          {chips.map((chip) => (
            <Button
              key={chip.key}
              type="button"
              variant="outline"
              colorVariant="neutral"
              disabled={isStreaming}
              className="h-auto shrink-0 whitespace-nowrap"
              onClick={() => {
                void send(chip.ask);
              }}
            >
              {chip.ask}
            </Button>
          ))}
        </div>
        {micOn && voiceInterview.liveTranscript ? (
          <p className="px-4 pb-1 text-1 text-neutral-11 md:px-6">
            “{voiceInterview.liveTranscript}”
          </p>
        ) : null}
        {dialogue && voiceInterview.voiceError ? (
          <p className="px-4 pb-1 text-1 text-neutral-11 md:px-6">
            {t('soundNeedsMic')}
          </p>
        ) : null}
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
          conversationMicrophone={{
            active: micOn,
            hearing: micOn && voiceInterview.userSpeaking,
            onToggle: toggleMic,
            muteLabel: t('micMute'),
            unmuteLabel: t('micUnmute'),
          }}
          accessory={
            <button
              type="button"
              aria-pressed={soundOn}
              aria-label={soundOn ? t('soundMute') : t('soundUnmute')}
              title={soundOn ? t('soundMute') : t('soundUnmute')}
              onClick={toggleSound}
              className={cn(
                'box-border inline-grid h-[36px] w-[36px] min-h-[36px] min-w-[36px] place-items-center bg-transparent p-0 text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                soundOn && 'text-foreground',
              )}
            >
              {soundOn ? (
                <Volume2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              ) : (
                <VolumeX className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
            </button>
          }
        />
      </div>
    </div>
  );
}
