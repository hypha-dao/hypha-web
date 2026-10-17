'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Link from 'next/link';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  listMemberHomeThreadItems,
  memberHomeBoardDestination,
  memberHomeItemMemory,
  memberHomeSignalCatalogue,
  mergeMemberHomeMemory,
  memberHomeThreadItemForMessage,
  memberHomeThreadItemKey,
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
import { prepareAssistantTextForSpeech } from '../../common/onboarding-voice-speech';
import { buildRecentTranscriptSummaryFromChatMessages } from '../../common/onboarding-voice-transcript-bridge';
import { buildMemberHomeVoiceSessionContext } from '../../common/space-voice-session-context';
import { useOnboardingVoiceDiscovery } from '../../common/use-onboarding-voice-discovery';
import { MEMBER_HOME_ASK_EVENT } from './member-home-ask';
import {
  bindHomePerson,
  consumeHomeReturn,
  homeReturnText,
  readHomeActed,
  readHomeChoices,
  readHomeThread,
  writeHomeChoices,
  writeHomeThread,
} from './member-home-resume';
import { MemberHomeActivationCard } from './member-home-activation-card';
import { MemberHomeMark } from './member-home-mark';
import { MemberHomeThreadCard } from './member-home-thread-card';
import { PersonAvatar } from './person-avatar';
import {
  MemberHomePeopleWidgetCard,
  MemberHomeSendTokensWidget,
  MemberHomeSpacesWidgetCard,
} from './member-home-chat-widgets';
import type { MemberHomeOpenChat } from './member-home-people';
import type { PresenceLevel } from './member-presence';
import { useMemberPresence } from './use-member-presence';

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
  /** Remaining queue, the same one the assistant is clearing. */
  onQueueMemory?: (memory: {
    passed: string[];
    deferred: string[];
    settled: string[];
    recalled: string[];
  }) => void;
};

type HomeMessage = UIMessage & {
  metadata?: {
    homeArrival?: boolean;
    homeBoard?: { href: string; title: string };
  };
};

function homeBoardFromMessage(message: HomeMessage) {
  const board = message.metadata?.homeBoard;
  if (
    !board ||
    typeof board.href !== 'string' ||
    typeof board.title !== 'string' ||
    !board.href.startsWith('/')
  ) {
    return null;
  }
  return { href: board.href, title: board.title };
}

/**
 * A new home turn must append. If the stream reuses an earlier assistant id,
 * the client writes the new words into that bubble.
 */
function continueHomeChatResponse(response: Response): Response {
  const stream = response.headers.get('x-vercel-ai-ui-message-stream');
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !response.body) return response;
  if (stream !== 'v1' && !contentType.includes('text/event-stream')) {
    return response;
  }
  const freshId = `msg-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const rewritten = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        if (lines.length === 0) return;
        controller.enqueue(
          encoder.encode(
            `${lines
              .map((line) => rewriteHomeStartLine(line, freshId))
              .join('\n')}\n`,
          ),
        );
      },
      flush(controller) {
        buffer += decoder.decode();
        if (!buffer) return;
        controller.enqueue(
          encoder.encode(rewriteHomeStartLine(buffer, freshId)),
        );
      },
    }),
  );
  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function rewriteHomeStartLine(line: string, freshId: string) {
  const prefix = 'data: ';
  if (!line.startsWith(prefix)) return line;
  const payload = line.slice(prefix.length).trim();
  if (!payload || payload === '[DONE]') return line;
  try {
    const chunk = JSON.parse(payload) as {
      type?: unknown;
      messageId?: unknown;
    };
    if (chunk.type !== 'start') return line;
    return `${prefix}${JSON.stringify({ ...chunk, messageId: freshId })}`;
  } catch {
    return line;
  }
}

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

/** One line of copy: no break, and at most one sentence-ending mark. */
function homeTextIsOneLine(text: string) {
  if (text.includes('\n')) return false;
  return (text.match(/[.!?]/g)?.length ?? 0) <= 1;
}

/** From `lg`: ~3/4 of the screen, inset in the main pane, capped at 72rem. */
export const HOME_CHAT_COLUMN =
  'mx-auto w-full min-w-0 lg:max-w-[min(75%,75vw,72rem)]';

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

/**
 * Chat bubble and spoken voice must share one script. Board copy replaces a
 * catalogue dump; speech prep strips what TTS would skip or truncate.
 */
function homeAssistantScript(input: {
  displayText: string;
  stripDecisionCue?: boolean;
}) {
  const base = input.displayText.trim();
  const withoutCue = input.stripDecisionCue
    ? base.replace(/You can now decide on the proposal card\.?/gi, '').trim()
    : base;
  return prepareAssistantTextForSpeech(withoutCue);
}

const HOME_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;

type MentionPerson = {
  id: number;
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function personMentionLabels(person: MentionPerson): string[] {
  const labels: string[] = [];
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  if (full) labels.push(full);
  const first = person.name?.trim();
  if (first) labels.push(first);
  const nick = person.nickname?.trim();
  if (nick) labels.push(nick);
  return [...new Set(labels)].sort((left, right) => right.length - left.length);
}

function homeMessageNodes(
  text: string,
  options?: {
    people?: readonly MentionPerson[];
    presenceById?: ReadonlyMap<number, PresenceLevel>;
  },
): ReactNode[] {
  const mentions: { label: string; personId: number }[] = [];
  const seenLabels = new Set<string>();
  for (const person of options?.people ?? []) {
    for (const label of personMentionLabels(person)) {
      if (label.length < 2) continue;
      const key = label.toLowerCase();
      if (seenLabels.has(key)) continue;
      seenLabels.add(key);
      mentions.push({ label, personId: person.id });
    }
  }
  const mentionPattern =
    mentions.length > 0
      ? mentions.map((mention) => escapeRegExp(mention.label)).join('|')
      : null;
  const pattern = mentionPattern
    ? new RegExp(
        `\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)|(https?:\\/\\/[^\\s)]+)|(${mentionPattern})`,
        'gi',
      )
    : HOME_LINK;

  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const href = match[2] ?? match[3];
    const linkLabel = match[1] ?? href;
    const mentionLabel = match[4];
    if (href && linkLabel) {
      nodes.push(
        <a
          key={`${index}-${href}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-11 underline underline-offset-4"
        >
          {linkLabel}
        </a>,
      );
    } else if (mentionLabel) {
      const mention = mentions.find(
        (entry) => entry.label.toLowerCase() === mentionLabel.toLowerCase(),
      );
      const presence =
        mention && options?.presenceById
          ? options.presenceById.get(mention.personId) ?? 'offline'
          : 'offline';
      const around = presence === 'active' || presence === 'idle';
      nodes.push(
        <span
          key={`${index}-${mentionLabel}`}
          className="inline-flex items-center gap-1"
        >
          <span>{mentionLabel}</span>
          {around ? (
            <span
              aria-hidden
              className={cn(
                'inline-block size-1.5 shrink-0 rounded-full',
                presence === 'active' ? 'bg-success-9' : 'bg-amber-9',
              )}
            />
          ) : null}
        </span>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MemberHomeChat({
  lang,
  intelligence,
  onChatPerson,
  onCallPerson,
  onVideoPerson,
  onFocusItem,
  onQueueMemory,
}: MemberHomeChatProps) {
  bindHomePerson(intelligence.person.slug);
  const t = useTranslations('MemberHome');
  const messagesRef = useRef<HomeMessage[]>([]);
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
  const seenMotionIds = useRef(new Set<string>());
  const settleSend = useRef(false);
  const glideScroll = useRef(false);
  const gliding = useRef(false);
  const pinnedToEnd = useRef(true);
  const settlingIds = useRef(new Set<string>());
  const connectionIds = useMemo(
    () => intelligence.connections.map((person) => person.id),
    [intelligence.connections],
  );
  const { presenceById } = useMemberPresence(connectionIds);

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
          memberHomeMemory: {
            ...readHomeChoices(),
            acted: readHomeActed(),
          },
        }),
        fetch: async (input, init) =>
          continueHomeChatResponse(await fetch(input, init)),
      }),
    [getAccessToken, lang],
  );

  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status,
    error,
    clearError,
  } = useChat({
    id: 'member-home',
    transport,
  });
  const isStreaming = status === 'streaming' || status === 'submitted';
  const homeMessages = messages as HomeMessage[];
  messagesRef.current = homeMessages;

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
      const reveal = !hidden;
      await stop();
      if (!hidden && files.length === 0) {
        const previousAssistant = [...messagesRef.current]
          .reverse()
          .find(
            (message) => message.role === 'assistant' && messageText(message),
          );
        const board = memberHomeBoardDestination({
          text: trimmed,
          previousAssistantText: previousAssistant
            ? messageText(previousAssistant)
            : '',
          spaces: intelligence.spaces,
          lang,
        });
        if (board) {
          const next: HomeMessage[] = [
            ...messagesRef.current,
            {
              id: `home-user-${crypto.randomUUID()}`,
              role: 'user',
              parts: [{ type: 'text', text: trimmed }],
            },
            {
              id: `home-assistant-${crypto.randomUUID()}`,
              role: 'assistant',
              metadata: {
                homeBoard: { href: board.href, title: board.title },
              },
              parts: [
                {
                  type: 'text',
                  text: t('boardInstead', { space: board.title }),
                },
              ],
            },
          ];
          if (reveal) {
            setInput('');
            if (includeDrafts) setDrafts([]);
            settleSend.current = true;
            glideScroll.current = true;
            pinnedToEnd.current = true;
          }
          setMessages(next);
          writeHomeThread(next);
          return;
        }
      }
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
      if (reveal) {
        setInput('');
        if (includeDrafts) setDrafts([]);
        settleSend.current = true;
        glideScroll.current = true;
        pinnedToEnd.current = true;
      }
      try {
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
              memberHomeMemory: {
                ...readHomeChoices(),
                acted: readHomeActed(),
              },
            },
          },
        );
      } catch (error) {
        if (reveal) setInput(trimmed);
        throw error;
      }
    },
    [
      clearError,
      drafts,
      getAccessToken,
      homeMessages.length,
      intelligence.spaces,
      lang,
      sendMessage,
      setMessages,
      stop,
      t,
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

  const voiceSessionContext = useMemo(
    () =>
      dialogue
        ? buildMemberHomeVoiceSessionContext({ locale: lang })
        : undefined,
    [dialogue, lang],
  );

  const threadItems = useMemo(
    () => listMemberHomeThreadItems(intelligence),
    [intelligence],
  );

  /** Same string the bubble shows — Realtime must speak this script. */
  const lastAssistantText = useMemo(() => {
    for (let i = homeMessages.length - 1; i >= 0; i -= 1) {
      const message = homeMessages[i];
      if (!message || message.role !== 'assistant') continue;
      const rawText = messageText(message).replace(/\*\*/g, '');
      if (!rawText) continue;
      const board =
        homeBoardFromMessage(message) ??
        memberHomeSignalCatalogue(rawText, intelligence.spaces, lang);
      const spokenItem = memberHomeThreadItemForMessage(threadItems, message);
      return homeAssistantScript({
        displayText: board
          ? t('boardInstead', { space: board.title })
          : straightforwardHomeText(rawText),
        stripDecisionCue: Boolean(
          spokenItem && spokenItem.action !== 'decision',
        ),
      });
    }
    return '';
  }, [homeMessages, intelligence.spaces, lang, t, threadItems]);

  const voiceInterview = useOnboardingVoiceDiscovery({
    enabled: soundReady && dialogue && !isAuthLoading && isAuthenticated,
    captureMicrophone: micOn,
    speakReplies: soundOn,
    speakEarlyLeadIn: false,
    isStreaming,
    lastAssistantText,
    locale: lang,
    activeSpaceSlug: HOME_VOICE_PREFERENCE_KEY,
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

  const micNeedsGrant =
    voiceInterview.voiceError === 'not-allowed' ||
    voiceInterview.voiceError === 'audio-capture';

  const toggleMic = useCallback(() => {
    if (micOn && (micNeedsGrant || Boolean(voiceInterview.voiceError))) {
      void voiceInterview.startListening();
      return;
    }
    setMicOn((current) => {
      const next = !current;
      if (next) void voiceInterview.startListening();
      writeHomeMicOn(next);
      return next;
    });
  }, [
    micNeedsGrant,
    micOn,
    voiceInterview.startListening,
    voiceInterview.voiceError,
  ]);

  useEffect(() => {
    if (!soundReady || opened.current || isAuthLoading || !isAuthenticated) {
      return;
    }
    opened.current = true;
    bindHomePerson(intelligence.person.slug);
    const stored = readHomeThread();
    const returned = consumeHomeReturn();
    if (stored.length > 0) setMessages(stored);
    if (returned != null) {
      void send(homeReturnText(returned), true);
      return;
    }
    if (stored.length > 0) return;
    void send(t('homeArrival'), true);
  }, [
    intelligence.person.slug,
    isAuthenticated,
    isAuthLoading,
    send,
    setMessages,
    soundReady,
    t,
  ]);

  useEffect(() => {
    if (!opened.current) return;
    writeHomeThread(homeMessages);
  }, [homeMessages]);

  useEffect(() => {
    const fromMessages = memberHomeItemMemory(threadItems, homeMessages);
    const merged = mergeMemberHomeMemory(fromMessages, readHomeChoices());
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
    writeHomeChoices({
      passed: merged.passed,
      deferred,
      settled: merged.settled,
    });
    onQueueMemory?.({
      passed: merged.passed,
      deferred: merged.deferred,
      settled: merged.settled,
      recalled: fromMessages.recalled,
    });
  }, [homeMessages, onQueueMemory, threadItems]);
  const cardsByMessageId = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, MemberHomeThreadItem>();
    for (const message of homeMessages) {
      if (message.role !== 'assistant' || message.metadata?.homeArrival) {
        continue;
      }
      const item = memberHomeThreadItemForMessage(threadItems, message);
      if (!item) continue;
      const key = memberHomeThreadItemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      map.set(message.id, item);
    }
    return map;
  }, [homeMessages, threadItems]);
  const cardMessageId = useMemo(() => {
    for (let index = homeMessages.length - 1; index >= 0; index -= 1) {
      const message = homeMessages[index];
      if (!message || message.role !== 'assistant') continue;
      if (message.metadata?.homeArrival) continue;
      if (memberHomeThreadItemForMessage(threadItems, message))
        return message.id;
    }
    return null;
  }, [homeMessages, threadItems]);
  const focusedItem = useMemo(() => {
    const message = homeMessages.find((item) => item.id === cardMessageId);
    return message
      ? memberHomeThreadItemForMessage(threadItems, message)
      : null;
  }, [cardMessageId, homeMessages, threadItems]);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const onScroll = () => {
      if (gliding.current) return;
      const gap = node.scrollHeight - node.scrollTop - node.clientHeight;
      pinnedToEnd.current = gap < 120;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);
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

  for (const message of homeMessages) {
    if (seenMotionIds.current.has(message.id)) continue;
    seenMotionIds.current.add(message.id);
    if (!settleSend.current || message.metadata?.homeArrival) continue;
    settlingIds.current.add(message.id);
    if (message.role === 'assistant') settleSend.current = false;
  }

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || !pinnedToEnd.current || gliding.current) return;
    const top = node.scrollHeight;
    const glide =
      glideScroll.current &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    glideScroll.current = false;
    if (Math.abs(node.scrollTop - top) < 2) return;
    if (glide) {
      gliding.current = true;
      node.scrollTo({ top, behavior: 'smooth' });
      window.setTimeout(() => {
        gliding.current = false;
        const current = scroller.current;
        if (current && pinnedToEnd.current) {
          current.scrollTop = current.scrollHeight;
        }
      }, 520);
      return;
    }
    node.scrollTop = top;
  }, [focusedItem, homeMessages, isStreaming, showSensing, widgets]);

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
          networkSignals={intelligence.networkSignals}
          selfId={intelligence.person.id}
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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <HomeSendMotion />
      <div
        ref={scroller}
        className="narrow-scrollbar min-h-0 w-full min-w-0 flex-1 overflow-y-auto"
        aria-label={t('conversation')}
      >
        <div className={cn(HOME_CHAT_COLUMN, 'grid gap-4 px-5 py-4 md:px-4')}>
          <MemberHomeActivationCard
            lang={lang}
            spaces={intelligence.expiringSpaces ?? []}
          />
          {homeMessages.map((message, index) => {
            const attached = widgets.filter(
              (widget) => widget.after === index + 1,
            );
            if (message.metadata?.homeArrival && attached.length === 0) {
              return null;
            }
            const rawText = messageText(message).replace(/\*\*/g, '');
            const board =
              message.role === 'assistant'
                ? homeBoardFromMessage(message) ??
                  memberHomeSignalCatalogue(rawText, intelligence.spaces, lang)
                : null;
            const spokenItem =
              message.role === 'assistant'
                ? memberHomeThreadItemForMessage(threadItems, message)
                : null;
            const text =
              message.role === 'assistant'
                ? homeAssistantScript({
                    displayText: board
                      ? t('boardInstead', { space: board.title })
                      : straightforwardHomeText(rawText),
                    stripDecisionCue: Boolean(
                      spokenItem && spokenItem.action !== 'decision',
                    ),
                  })
                : rawText;
            const pinnedItem =
              message.role === 'assistant'
                ? cardsByMessageId.get(message.id) ?? null
                : null;
            const keepsCard = pinnedItem != null;
            const showMessage =
              (!message.metadata?.homeArrival && Boolean(text)) || keepsCard;
            if (!showMessage && attached.length === 0) return null;
            const mine = message.role === 'user';
            const oneLine =
              text.length > 0 &&
              (mine || (!board && !pinnedItem)) &&
              homeTextIsOneLine(text);
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
                      settlingIds.current.has(message.id) && 'home-send-settle',
                      mine ? 'justify-end' : 'justify-start',
                      oneLine ? 'items-center' : 'items-start',
                    )}
                  >
                    {mine ? null : (
                      <MemberHomeMark
                        className={cn('h-8 w-8 shrink-0', !oneLine && 'mt-0.5')}
                      />
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
                          {homeMessageNodes(text, {
                            people: intelligence.connections,
                            presenceById,
                          })}
                        </p>
                      ) : null}
                      {!mine && board ? (
                        <Link
                          href={board.href}
                          className="inline-flex h-10 w-fit items-center border border-foreground bg-foreground px-3 text-1 tracking-[0.12em] text-background uppercase"
                        >
                          {t('openSignalsBoard')}
                        </Link>
                      ) : null}
                      {!mine && pinnedItem ? (
                        <MemberHomeThreadCard
                          chat
                          lang={lang}
                          item={pinnedItem}
                          proposal={
                            pinnedItem.kind === 'proposal'
                              ? intelligence.proposals.find(
                                  (proposal) =>
                                    proposal.slug === pinnedItem.slug,
                                ) ?? null
                              : null
                          }
                          onAsk={(ask, hidden) => {
                            void send(ask, Boolean(hidden));
                          }}
                          onReach={(person, mode) =>
                            mode === 'call'
                              ? onCallPerson(person)
                              : onChatPerson(person)
                          }
                        />
                      ) : null}
                    </div>
                    {mine ? (
                      <PersonAvatar
                        avatarSrc={intelligence.person.avatarUrl ?? undefined}
                        userName={memberName}
                        size="md"
                        shape="circle"
                        className={cn('shrink-0', !oneLine && 'mt-0.5')}
                      />
                    ) : null}
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
            <article className="home-send-settle flex gap-3" aria-live="polite">
              <MemberHomeMark className="home-send-breathe mt-0.5 h-8 w-8" />
              <p className="text-2 leading-relaxed text-neutral-11">
                {t('thinking')}
              </p>
            </article>
          ) : null}
        </div>
      </div>

      {visibleError ? (
        <div className={cn(HOME_CHAT_COLUMN, 'mb-2 px-5 md:px-4')}>
          <div className="border border-border bg-background-2 px-3 py-2 text-2">
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
                        message.role === 'user' &&
                        !message.metadata?.homeArrival,
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
        </div>
      ) : null}

      <div className={cn(HOME_CHAT_COLUMN, 'shrink-0 pb-3')}>
        <div className="mx-5 mb-2 flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto pt-2 [scrollbar-width:none] md:mx-4 [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              disabled={isStreaming}
              className="shrink-0 rounded-none border border-foreground bg-transparent px-3 py-2 text-[11px] font-medium leading-none whitespace-nowrap text-foreground disabled:opacity-50"
              onClick={() => {
                void send(chip.ask);
              }}
            >
              {chip.ask}
            </button>
          ))}
        </div>
        {micOn && voiceInterview.liveTranscript ? (
          <p className="px-5 pb-1 text-1 text-neutral-11 md:px-4">
            “{voiceInterview.liveTranscript}”
          </p>
        ) : null}
        {dialogue && micNeedsGrant ? (
          <button
            type="button"
            onClick={() => {
              void voiceInterview.startListening();
            }}
            className="px-5 pb-1 text-left text-1 text-neutral-11 md:px-4"
          >
            {t('soundNeedsMic')}
          </button>
        ) : null}
        <div className="mx-5 border border-border bg-background md:mx-4">
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
            topRule={false}
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
    </div>
  );
}

function HomeSendMotion() {
  return (
    <style>{`
      @keyframes home-send-settle {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .home-send-settle {
        animation: home-send-settle 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes home-send-breathe {
        0%, 100% { opacity: 0.38; }
        50% { opacity: 1; }
      }
      .home-send-breathe {
        animation: home-send-breathe 1.8s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .home-send-settle,
        .home-send-breathe {
          animation: none;
        }
      }
    `}</style>
  );
}
