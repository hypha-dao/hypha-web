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
  listMemberHomeThreadCatalog,
  listMemberHomeThreadItems,
  memberHomeBoardDestination,
  memberHomeDirectReply,
  memberHomeLookItem,
  memberHomeTalkIsResting,
  memberHomeThreadItemForRef,
  type MemberHomeDirectReply,
  memberHomeItemMemory,
  memberHomeSignalCatalogue,
  mergeMemberHomeMemory,
  isMemberHomeItemDecline,
  isMemberHomeItemDeferral,
  memberHomeCardForSpeech,
  memberHomeSpeechConflictsWithItem,
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
import { buildMemberHomeVoiceSessionContext } from '../../common/space-voice-session-context';
import { useHomeLeftPanelVoiceActive } from '../../common/home-left-panel-voice';
import { useOnboardingVoiceDiscovery } from '../../common/use-onboarding-voice-discovery';
import { readRecentSpaceSlugs } from '../../common/recent-space-history';
import { MEMBER_HOME_ASK_EVENT } from './member-home-ask';
import {
  bindHomePerson,
  consumeHomeReturn,
  HOME_QUEUE_EVENT,
  homeReturnText,
  readHomeActed,
  readHomeChoices,
  readHomeShownItems,
  readHomeThread,
  rememberHomeShownItem,
  writeHomeChoices,
  writeHomeThread,
} from './member-home-resume';
import {
  MEMBER_HOME_PEOPLE_LEAD_KEYS,
  MEMBER_HOME_SPACE_LEAD_KEYS,
  nextMemberHomeLeadKey,
} from './member-home-leads';
import { MemberHomeActivationCard } from './member-home-activation-card';
import { MemberHomeOnboardingCards } from './member-home-onboarding-cards';
import { generatedVisualsFromParts } from '../../common/onboarding-visual-assets';
import { useOnboardingSpaceSignature } from '../../common/use-onboarding-space-signature';
import { MemberHomeMark } from './member-home-mark';
import { memberHomeReplyReady } from './member-home-phase';
import { HomeWave } from './member-home-wave';
import { MemberHomeThreadCard } from './member-home-thread-card';
import { PersonAvatar } from './person-avatar';
import {
  MemberHomePeopleWidgetCard,
  MemberHomeSendTokensWidget,
  MemberHomeSpacesWidgetCard,
} from './member-home-chat-widgets';
import type { MemberHomeOpenChat } from './member-home-people';
import { homeAssistantTurnSucceeded } from './member-home-chat-error';

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
    // Off until they turn it on. That choice stays until they turn it off.
    return window.localStorage.getItem(HOME_SOUND_KEY) === 'on';
  } catch {
    return false;
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
    // Off until they turn it on. That choice stays until they turn it off.
    return window.localStorage.getItem(HOME_MIC_KEY) === 'on';
  } catch {
    return false;
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
    homeItem?: { kind: string; slug: string };
    homeError?: boolean;
  };
};

function isHomeErrorMessage(message: { metadata?: unknown }) {
  const metadata = message.metadata;
  return (
    metadata != null &&
    typeof metadata === 'object' &&
    'homeError' in metadata &&
    (metadata as { homeError?: unknown }).homeError === true
  );
}

function messageIsHomeArrival(message: { metadata?: unknown }) {
  const metadata = message.metadata;
  return (
    metadata != null &&
    typeof metadata === 'object' &&
    'homeArrival' in metadata &&
    (metadata as { homeArrival?: unknown }).homeArrival === true
  );
}

function homeItemRef(
  items: readonly MemberHomeThreadItem[],
  home: MemberIntelligence | undefined,
  ref: { kind: string; slug: string } | null | undefined,
): MemberHomeThreadItem | null {
  if (!ref || (ref.kind !== 'proposal' && ref.kind !== 'signal') || !ref.slug) {
    return null;
  }
  return (
    items.find((item) => item.kind === ref.kind && item.slug === ref.slug) ??
    (home
      ? memberHomeThreadItemForRef(home, {
          kind: ref.kind,
          slug: ref.slug,
        })
      : null)
  );
}

function homeItemForMessage(
  items: readonly MemberHomeThreadItem[],
  message: HomeMessage,
  home?: MemberIntelligence,
): MemberHomeThreadItem | null {
  const fromHint = homeItemRef(items, home, message.metadata?.homeItem);
  // Speech matching already keeps or drops the hint. Never force a hint
  // after a conflict — that put the previous/next signal under this reply.
  return memberHomeCardForSpeech({
    items,
    message,
    hinted: fromHint,
    spaceTitles: home?.spaces.map((space) => space.title) ?? [],
  });
}

/** The card under this reply. The item they just set aside stays off it. */
function pinnedHomeItem(
  items: readonly MemberHomeThreadItem[],
  messages: readonly HomeMessage[],
  index: number,
  home?: MemberIntelligence,
): MemberHomeThreadItem | null {
  const message = messages[index];
  if (!message || message.role !== 'assistant') return null;
  const item = homeItemForMessage(items, message, home);
  if (!item) return null;
  const asked = userTextBefore(messages, index);
  if (!isMemberHomeItemDeferral(asked) && !isMemberHomeItemDecline(asked)) {
    return item;
  }
  const named = memberHomeThreadItemForMessage(items, { content: asked });
  let aside = named;
  if (!aside) {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const earlier = messages[cursor];
      if (earlier?.role !== 'assistant') continue;
      aside = homeItemForMessage(items, earlier, home);
      break;
    }
  }
  if (
    !aside ||
    memberHomeThreadItemKey(aside) !== memberHomeThreadItemKey(item)
  ) {
    return item;
  }
  // The ack named the set-aside item. Only move on when this reply also
  // names another open item — never grab the next catalog row by default.
  const remaining = items.filter(
    (entry) =>
      memberHomeThreadItemKey(entry) !== memberHomeThreadItemKey(aside),
  );
  const next = homeItemForMessage(remaining, message, home);
  if (
    next &&
    memberHomeThreadItemKey(next) !== memberHomeThreadItemKey(aside)
  ) {
    return next;
  }
  return null;
}

/** Live catalog first, then cards already shown in this thread. */
function mergeHomeCardItems(
  live: readonly MemberHomeThreadItem[],
  shown: readonly MemberHomeThreadItem[],
) {
  const byKey = new Map<string, MemberHomeThreadItem>();
  for (const item of shown) {
    byKey.set(memberHomeThreadItemKey(item), item);
  }
  for (const item of live) {
    byKey.set(memberHomeThreadItemKey(item), item);
  }
  return [...byKey.values()];
}

function sameHomeShownItemKeys(
  left: readonly MemberHomeThreadItem[],
  right: readonly MemberHomeThreadItem[],
) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (!a || !b) return false;
    if (memberHomeThreadItemKey(a) !== memberHomeThreadItemKey(b)) return false;
  }
  return true;
}

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
function continueHomeChatResponse(
  response: Response,
  droppedLine: string,
): Response {
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
  const sawAssistantText = { current: false };
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
              .map((line) =>
                rewriteHomeStartLine(
                  line,
                  freshId,
                  droppedLine,
                  sawAssistantText,
                ),
              )
              .join('\n')}\n`,
          ),
        );
      },
      flush(controller) {
        buffer += decoder.decode();
        if (!buffer) return;
        controller.enqueue(
          encoder.encode(
            `${rewriteHomeStartLine(
              buffer,
              freshId,
              droppedLine,
              sawAssistantText,
            )}\n`,
          ),
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

function rewriteHomeStartLine(
  line: string,
  freshId: string,
  droppedLine: string,
  sawAssistantText: { current: boolean },
) {
  const prefix = 'data: ';
  if (!line.startsWith(prefix)) return line;
  const payload = line.slice(prefix.length).trim();
  if (!payload || payload === '[DONE]') return line;
  try {
    const chunk = JSON.parse(payload) as {
      type?: unknown;
      messageId?: unknown;
    };
    if (chunk.type === 'start') {
      return `${prefix}${JSON.stringify({ ...chunk, messageId: freshId })}`;
    }
    // Reasoning is not shown on home. A delta without its start throws in
    // useChat and paints the dropped-thread banner.
    if (typeof chunk.type === 'string' && chunk.type.startsWith('reasoning-')) {
      return '';
    }
    if (chunk.type === 'text-start' || chunk.type === 'text-delta') {
      sawAssistantText.current = true;
      return line;
    }
    // A fatal error chunk throws inside useChat and paints "thread dropped",
    // which then looks like the assistant restarted. Finish the turn as text
    // only when the model has not already spoken.
    if (chunk.type === 'error') {
      if (sawAssistantText.current) return '';
      const text = droppedLine;
      const id = `e${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      // Each event needs a blank line. A single newline joins the JSON into
      // one payload, which the client rejects and shows as a dropped thread.
      return `${[
        `${prefix}${JSON.stringify({
          type: 'message-metadata',
          messageMetadata: { homeError: true },
        })}`,
        `${prefix}${JSON.stringify({ type: 'text-start', id })}`,
        `${prefix}${JSON.stringify({ type: 'text-delta', id, delta: text })}`,
        `${prefix}${JSON.stringify({ type: 'text-end', id })}`,
      ].join('\n\n')}\n\n`;
    }
    return line;
  } catch {
    return line;
  }
}

function userTextBefore(messages: readonly HomeMessage[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const message = messages[cursor];
    if (message?.role === 'user') return messageText(message);
  }
  return '';
}

function directReplyText(
  reply: MemberHomeDirectReply,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (reply.line.key) {
    case 'people':
      // Shared-space ranking is not what "Who is around?" asks. The widget
      // already sorts by presence — just point at the list. Rotate copy so
      // the same chip does not always speak the same sentence.
      return t(
        nextMemberHomeLeadKey('people', MEMBER_HOME_PEOPLE_LEAD_KEYS),
      );
    case 'peopleEmpty':
      return t('peopleWidgetEmpty');
    case 'space':
      // Do not name a lead space — picking Hypha Platform (or any parent)
      // as "start here" is bad advice. The widget already lists them.
      // Rotate neutral list leads across the session.
      return t(nextMemberHomeLeadKey('space', MEMBER_HOME_SPACE_LEAD_KEYS));
    case 'spaceEmpty':
      return t('spacesWidgetEmpty');
    case 'tokens':
      return t('tokensLead', { name: reply.line.name });
    case 'tokensEmpty':
      return t('tokensLeadEmpty');
    case 'decisionOpen':
      return t('decisionOpen', {
        title: reply.line.title,
        space: reply.line.space,
      });
    case 'decisionListed':
      return t('decisionListed', {
        title: reply.line.title,
        space: reply.line.space,
      });
    case 'decisionQuiet':
      return t('decisionQuiet');
    case 'itemOpen':
      return t('itemOpen', {
        title: reply.line.title,
        space: reply.line.space,
      });
    case 'usefulQuiet':
      return t('usefulQuiet');
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

/** Short copy beside the mark. Two short sentences still sit on one row. */
function homeTextIsOneLine(text: string) {
  if (text.includes('\n') || text.length > 220) return false;
  return (text.match(/[.!?]/g)?.length ?? 0) <= 2;
}

/** From `lg`: ~3/4 of the screen, inset in the main pane, capped at 72rem. */
export const HOME_CHAT_COLUMN =
  'mx-auto w-full min-w-0 lg:max-w-[min(75%,75vw,72rem)]';

/** Compare lines after a lead-in so "Next up: …" and "…" count as one line. */
function homeSentenceKey(sentence: string) {
  return sentence
    .toLowerCase()
    .replace(/^(?:next up|up next)\s*:\s*/u, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function repeatsHomeSentence(sentence: string, earlier: string[]) {
  const key = homeSentenceKey(sentence);
  if (key.length < 24) return false;
  return earlier.some((previous) => {
    const other = homeSentenceKey(previous);
    if (other.length < 24) return false;
    return key === other || key.includes(other) || other.includes(key);
  });
}

/** A model that cannot call a tool sometimes prints the call. Never show that. */
function stripLeakedToolMarkup(text: string) {
  return text
    .replace(/<\s*\|?\s*DSML\b[\s\S]*?<\s*\/\s*\|?\s*DSML\b[^>]*>/gi, ' ')
    .replace(/<\s*\|?\s*DSML\b[\s\S]*$/gi, ' ')
    .replace(/<\/?\s*\|[^>\n]*>/g, ' ')
    .replace(/<\/?(?:tool_call|invoke|parameter|function_call)\b[^>]*>/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function looksLikeToolLeak(sentence: string) {
  return /DSML|invoke\s+name\s*=|parameter\s+name\s*=|get_people_by_space_slug|show_member_home_item|<\s*\|/i.test(
    sentence,
  );
}

/** A decision stays with the member. Drop narration and any ask for their choice. */
function straightforwardHomeText(text: string) {
  const steers = (sentence: string) =>
    /i['’]ll show you|here(?:'|’)s the proposal|here is the proposal|the proposal titled|if you approve|your approval|can you review|do you approve|would you approve|would you like to approve|what would you like to decide|want to take a look|i(?:'’)?ve approved|\bi approved\b|\bi have approved\b|\bi accepted\b|i(?:'’)?ve accepted|\bi voted\b|you can now see the message|think about it|approval is required|to proceed with|how (?:will|would) you vote|let me know if you|^sure[.!]?$/i.test(
      sentence,
    );
  const sentences = stripLeakedToolMarkup(text)
    .replace(/\*\*/g, '')
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  // A sentence still arriving has no ending mark. Hiding it as soon as it
  // starts to look like narration blanks the bubble, then the next sentence
  // mounts it again. A second step often repeats the line it just finished.
  const kept: string[] = [];
  const cleaned = sentences
    .filter((sentence, index) => {
      const stillArriving =
        index === sentences.length - 1 && !/[.!?]$/.test(sentence);
      if (looksLikeToolLeak(sentence)) return false;
      if (!stillArriving && steers(sentence)) return false;
      if (repeatsHomeSentence(sentence, kept)) return false;
      kept.push(sentence);
      return true;
    })
    .join(' ')
    .trim();
  return cleaned;
}

/**
 * Chat bubble and spoken voice must share one script. Board copy replaces a
 * catalogue dump. Speech prep that waits for a full sentence hides the line
 * and then shows it again, so the bubble keeps this text as it arrives.
 */
function homeAssistantScript(input: {
  displayText: string;
  stripDecisionCue?: boolean;
}) {
  const base = input.displayText.trim();
  if (!input.stripDecisionCue) return base;
  // Dropping the cue can leave a dangling dash from "…decision — You can…"
  return base
    .replace(/You can now decide on the proposal card\.?/gi, '')
    .replace(/\s*[-—–:]\s*$/u, '')
    .trim();
}

const HOME_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;

function homeMessageNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(HOME_LINK)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const href = match[2] ?? match[3];
    const linkLabel = match[1] ?? href;
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
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Glide the thread onto a card so the move itself is visible, then call back. */
function glideScrollerTo(
  node: HTMLElement,
  top: number,
  onFrame: (id: number) => void,
  onDone: () => void,
) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || Math.abs(node.scrollTop - top) < 2) {
    node.scrollTop = top;
    onDone();
    return;
  }
  const from = node.scrollTop;
  const delta = top - from;
  const duration = Math.min(1400, Math.max(720, Math.abs(delta) * 0.65));
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    node.scrollTop = from + delta * eased;
    if (t < 1) onFrame(requestAnimationFrame(step));
    else onDone();
  };
  onFrame(requestAnimationFrame(step));
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
  const [soundOn, setSoundOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [voiceHydrated, setVoiceHydrated] = useState(false);
  const [widgets, setWidgets] = useState<HomeWidget[]>([]);
  const opened = useRef(false);
  const startedTalk = useRef(false);
  const pendingStart = useRef<
    { kind: 'return'; text: string } | { kind: 'arrival' } | null
  >(null);
  const scroller = useRef<HTMLDivElement>(null);
  const seenMotionIds = useRef(new Set<string>());
  const settleSend = useRef(false);
  const glideScroll = useRef(false);
  const gliding = useRef(false);
  const glideTimer = useRef<number | null>(null);
  const pinnedToEnd = useRef(true);
  const holdVoiceRef = useRef(false);
  const [holdVoice, setHoldVoice] = useState(false);
  const arrivalBaselineIds = useRef(new Set<string>());
  const arrivalScrollStarted = useRef(false);
  const arrivalScrollFinished = useRef(false);
  const arrivalFrame = useRef<number | null>(null);
  const isStreamingRef = useRef(false);
  const settlingIds = useRef(new Set<string>());
  // Last non-empty line for the message that is still streaming. A cleaner
  // gap must not unmount the bubble and play the entrance animation again.
  const heldBubbleText = useRef(new Map<string, string>());
  /** Card frozen under each finished reply. Live rematch was jumping links. */
  const frozenHomeCards = useRef(
    new Map<string, { kind: string; slug: string }>(),
  );
  const droppedLine = useRef(t('threadDropped'));
  useLayoutEffect(() => {
    droppedLine.current = t('threadDropped');
  }, [t]);

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
          continueHomeChatResponse(
            await fetch(input, init),
            droppedLine.current,
          ),
        prepareSendMessagesRequest: ({
          id,
          messages,
          body,
          trigger,
          messageId,
        }) => ({
          body: {
            ...body,
            id,
            messages: messages.filter(
              (message) => !isHomeErrorMessage(message),
            ),
            trigger,
            messageId,
          },
        }),
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
  isStreamingRef.current = isStreaming;
  const homeMessages = messages as HomeMessage[];
  messagesRef.current = homeMessages;
  useLayoutEffect(() => {
    if (!error) return;
    const current = messagesRef.current;
    const last = current[current.length - 1];
    const fallback = droppedLine.current;
    const lastText = last?.role === 'assistant' ? messageText(last) : '';
    // Keeping `error` after CodeRabbit's homeError change left the banner up
    // when a late stream close followed a real reply. Clear that false drop.
    if (homeAssistantTurnSucceeded(last, lastText, fallback)) {
      clearError();
      return;
    }
    const alreadyTold = last?.role === 'assistant' && lastText === fallback;
    if (!alreadyTold) {
      setMessages([
        ...current,
        {
          id: `home-assistant-${crypto.randomUUID()}`,
          role: 'assistant',
          metadata: { homeError: true },
          parts: [{ type: 'text', text: fallback }],
        },
      ]);
    }
  }, [clearError, error, setMessages]);
  useOnboardingSpaceSignature(homeMessages, lang);

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
      if (reveal) {
        if (arrivalFrame.current != null) {
          cancelAnimationFrame(arrivalFrame.current);
          arrivalFrame.current = null;
        }
        holdVoiceRef.current = false;
        arrivalScrollStarted.current = false;
        arrivalScrollFinished.current = false;
        setHoldVoice(false);
      }
      await stop();
      const withoutErrors = messagesRef.current.filter(
        (message) => !isHomeErrorMessage(message),
      );
      if (withoutErrors.length !== messagesRef.current.length) {
        setMessages(withoutErrors);
        messagesRef.current = withoutErrors;
      }
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
      const direct =
        trimmed && files.length === 0
          ? memberHomeDirectReply(intelligence, trimmed, {
              recentSpaceSlugs: readRecentSpaceSlugs(),
              phrases: {
                people: [t('chipPeople')],
                spaces: [t('chipSpace')],
                tokens: [t('chipTokens')],
                decision: [t('chipDecision')],
                useful: [t('chipUseful'), t('homeArrival')],
              },
            })
          : null;
      if (direct) {
        const base = messagesRef.current.filter(
          (message) => !isHomeErrorMessage(message),
        );
        if (direct.item) {
          const full = memberHomeThreadItemForRef(intelligence, direct.item);
          if (full) {
            rememberHomeShownItem(full);
            setShownCardItems(readHomeShownItems());
          }
        }
        const next: HomeMessage[] = [
          ...base,
          {
            id: `home-user-${crypto.randomUUID()}`,
            role: 'user',
            metadata: hidden ? { homeArrival: true } : undefined,
            parts: [{ type: 'text', text: trimmed }],
          },
          {
            id: `home-assistant-${crypto.randomUUID()}`,
            role: 'assistant',
            metadata: direct.item ? { homeItem: direct.item } : undefined,
            parts: [{ type: 'text', text: directReplyText(direct, t) }],
          },
        ];
        const widget = direct.widget;
        if (!hidden && widget) {
          setWidgets((current) => [
            ...current,
            {
              id: `${widget}-${Date.now()}`,
              kind: widget,
              after: base.length + 1,
            },
          ]);
        }
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
      const lookedUp =
        trimmed && files.length === 0
          ? memberHomeLookItem(
              listMemberHomeThreadCatalog(intelligence),
              messagesRef.current,
              trimmed,
            )
          : null;
      if (lookedUp) {
        const base = messagesRef.current.filter(
          (message) => !isHomeErrorMessage(message),
        );
        rememberHomeShownItem(lookedUp);
        setShownCardItems(readHomeShownItems());
        const next: HomeMessage[] = [
          ...base,
          {
            id: `home-user-${crypto.randomUUID()}`,
            role: 'user',
            parts: [{ type: 'text', text: trimmed }],
          },
          {
            id: `home-assistant-${crypto.randomUUID()}`,
            role: 'assistant',
            metadata: {
              homeItem: { kind: lookedUp.kind, slug: lookedUp.slug },
            },
            parts: [
              {
                type: 'text',
                text: t('itemOpen', {
                  title: lookedUp.title,
                  space: lookedUp.spaceTitle,
                }),
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
      intelligence,
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
  // The walk is short. The card can be any open item the brief names.
  const liveCardItems = useMemo(
    () => listMemberHomeThreadCatalog(intelligence),
    [intelligence],
  );
  const [shownCardItems, setShownCardItems] = useState<MemberHomeThreadItem[]>(
    () => (typeof window === 'undefined' ? [] : readHomeShownItems()),
  );
  const [actedKeys, setActedKeys] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readHomeActed(),
  );
  useEffect(() => {
    const sync = () => {
      const nextShown = readHomeShownItems();
      const nextActed = readHomeActed();
      setShownCardItems((current) =>
        sameHomeShownItemKeys(current, nextShown) ? current : nextShown,
      );
      setActedKeys((current) =>
        current.length === nextActed.length &&
        current.every((key, index) => key === nextActed[index])
          ? current
          : nextActed,
      );
    };
    sync();
    window.addEventListener(HOME_QUEUE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(HOME_QUEUE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const cardItems = useMemo(
    () => mergeHomeCardItems(liveCardItems, shownCardItems),
    [liveCardItems, shownCardItems],
  );
  const actedKeySet = useMemo(() => new Set(actedKeys), [actedKeys]);

  /**
   * Same string the bubble shows. While the latest reply is still streaming,
   * a momentary empty clean keeps the previous words so the row does not
   * unmount. Realtime speaks this script, never the reply before it.
   */
  const shownAssistantText = useMemo(() => {
    const shown = new Map<string, string>();
    const lastMessage = homeMessages[homeMessages.length - 1];
    const live = new Set<string>();
    homeMessages.forEach((message, index) => {
      if (message.role !== 'assistant') return;
      live.add(message.id);
      const rawText = stripLeakedToolMarkup(
        messageText(message).replace(/\*\*/g, ''),
      );
      const listAsk = widgetKindFor(userTextBefore(homeMessages, index));
      const board =
        rawText && !listAsk
          ? homeBoardFromMessage(message) ??
            memberHomeSignalCatalogue(rawText, intelligence.spaces, lang)
          : null;
      const spokenItem =
        rawText && !listAsk
          ? homeItemForMessage(cardItems, message, intelligence)
          : null;
      const cleaned = rawText
        ? homeAssistantScript({
            displayText: board
              ? t('boardInstead', { space: board.title })
              : straightforwardHomeText(rawText),
            stripDecisionCue: Boolean(
              spokenItem && spokenItem.action !== 'decision',
            ),
          })
        : '';
      const streamingThis = isStreaming && message.id === lastMessage?.id;
      const script =
        cleaned ||
        (!streamingThis && listAsk === 'people'
          ? intelligence.connections.some(
              (person) => person.id !== intelligence.person.id,
            )
            ? // Direct replies already rotated at send time. This is only a
              // stream-empty fallback — keep the primary lead, do not advance.
              t('peopleAroundLead')
            : t('peopleWidgetEmpty')
          : '');
      if (script) heldBubbleText.current.set(message.id, script);
      const text =
        script ||
        (streamingThis ? heldBubbleText.current.get(message.id) ?? '' : '');
      if (!streamingThis && !script) heldBubbleText.current.delete(message.id);
      if (text) shown.set(message.id, text);
    });
    for (const id of [...heldBubbleText.current.keys()]) {
      if (!live.has(id)) heldBubbleText.current.delete(id);
    }
    return shown;
  }, [
    cardItems,
    homeMessages,
    intelligence,
    isStreaming,
    lang,
    t,
    widgetKindFor,
  ]);

  /**
   * Latest assistant bubble only. Falling through to an older reply makes
   * voice re-read that line on every turn while the chat has moved on.
   */
  const lastAssistantMessage = useMemo(() => {
    for (let i = homeMessages.length - 1; i >= 0; i -= 1) {
      const message = homeMessages[i];
      if (!message || message.role !== 'assistant') continue;
      if (message.metadata?.homeArrival) continue;
      return message;
    }
    return null;
  }, [homeMessages]);

  const lastAssistantText = lastAssistantMessage
    ? shownAssistantText.get(lastAssistantMessage.id) ?? ''
    : '';
  const lastAssistantMessageId = lastAssistantMessage?.id ?? '';

  const leftPanelVoice = useHomeLeftPanelVoiceActive();
  const voiceInterview = useOnboardingVoiceDiscovery({
    enabled:
      soundReady &&
      voiceHydrated &&
      dialogue &&
      !isAuthLoading &&
      isAuthenticated,
    captureMicrophone: micOn,
    // The left panel is the Home speaker while its sound is on.
    speakReplies: soundOn && !leftPanelVoice,
    // Wait for the finished bubble. An early first sentence plus the cleaned
    // final script was stacking two voices on the same reply.
    speakEarlyLeadIn: false,
    speakDisplayedText: true,
    isStreaming,
    lastAssistantText: holdVoice ? '' : lastAssistantText,
    lastAssistantMessageId,
    locale: lang,
    activeSpaceSlug: HOME_VOICE_PREFERENCE_KEY,
    conversationContext: voiceSessionContext,
    // Home voice is a relay for the bubble. A transcript summary in the
    // session makes Realtime repeat the first briefing instead of the chat.
    recentTranscriptSummary: undefined,
    getAccessToken,
    // The open mic stays on. send() ends the previous turn when a real
    // transcript is submitted.
    onSendTranscript: handleVoiceTranscriptSend,
  });

  // Show dictation in the composer while they speak, so they can see it land.
  const lastDictationRef = useRef('');
  useEffect(() => {
    if (!micOn) {
      lastDictationRef.current = '';
      return;
    }
    const live = voiceInterview.liveTranscript.trim();
    if (live) {
      lastDictationRef.current = live;
      setInput(live);
      return;
    }
    if (!lastDictationRef.current) return;
    const previous = lastDictationRef.current;
    lastDictationRef.current = '';
    setInput((current) => (current.trim() === previous ? '' : current));
  }, [micOn, voiceInterview.liveTranscript]);

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
      pendingStart.current = {
        kind: 'return',
        text: homeReturnText(returned),
      };
    } else if (
      !memberHomeTalkIsResting(stored) &&
      stored.length === 0 &&
      threadItems.length > 0
    ) {
      // First open with an empty thread: greet and brief. Returning from an
      // action uses consumeHomeReturn above. Do not auto-continue on remount —
      // that re-sent the same briefing every crash/navigation remount.
      pendingStart.current = { kind: 'arrival' };
    }
    // Voice baselines this thread first, then the next effect speaks a start.
    setVoiceHydrated(true);
  }, [
    intelligence.person.slug,
    isAuthenticated,
    isAuthLoading,
    setMessages,
    soundReady,
    threadItems.length,
  ]);

  useEffect(() => {
    if (!voiceHydrated || startedTalk.current) return;
    startedTalk.current = true;
    const pending = pendingStart.current;
    pendingStart.current = null;
    if (!pending) return;
    if (pending.kind === 'return') void send(pending.text, true);
    else void send(t('homeArrival'), true);
  }, [send, t, voiceHydrated]);

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
  useEffect(() => {
    let remembered = false;
    homeMessages.forEach((message, index) => {
      if (message.role !== 'assistant' || message.metadata?.homeArrival) {
        return;
      }
      const asked = widgetKindFor(userTextBefore(homeMessages, index));
      if (asked === 'people' || asked === 'spaces' || asked === 'tokens') {
        return;
      }
      const item = homeItemForMessage(liveCardItems, message, intelligence);
      if (!item) return;
      rememberHomeShownItem(item);
      remembered = true;
    });
    if (!remembered) return;
    const next = readHomeShownItems();
    setShownCardItems((current) =>
      sameHomeShownItemKeys(current, next) ? current : next,
    );
  }, [homeMessages, intelligence, liveCardItems, widgetKindFor]);

  const cardsByMessageId = useMemo(() => {
    // Each finished reply keeps the card it earned. Rematching every
    // catalog tweak moved older links onto the previous or next signal.
    const map = new Map<string, MemberHomeThreadItem>();
    const liveIds = new Set(homeMessages.map((message) => message.id));
    for (const id of frozenHomeCards.current.keys()) {
      if (!liveIds.has(id)) frozenHomeCards.current.delete(id);
    }
    const lastMessage = homeMessages[homeMessages.length - 1];
    const spaceTitles = [
      ...cardItems.map((item) => item.spaceTitle),
      ...intelligence.spaces.map((space) => space.title),
    ];
    homeMessages.forEach((message, index) => {
      if (message.role !== 'assistant' || message.metadata?.homeArrival) {
        return;
      }
      // The people, spaces, and token chips already have their own panel.
      // A tool call on that turn must not pin the next signal underneath.
      const asked = widgetKindFor(userTextBefore(homeMessages, index));
      if (asked === 'people' || asked === 'spaces' || asked === 'tokens') {
        return;
      }
      const streamingThis = isStreaming && message.id === lastMessage?.id;
      const text = messageText(message);
      const frozen = frozenHomeCards.current.get(message.id);
      if (frozen && !streamingThis) {
        const kept = homeItemRef(cardItems, intelligence, frozen);
        const peerNames = cardItems.map((entry) => entry.creatorName);
        if (
          kept &&
          !memberHomeSpeechConflictsWithItem(kept, text, spaceTitles, peerNames)
        ) {
          map.set(message.id, kept);
          return;
        }
        frozenHomeCards.current.delete(message.id);
      }
      const item = pinnedHomeItem(cardItems, homeMessages, index, intelligence);
      if (!item) return;
      map.set(message.id, item);
      if (!streamingThis) {
        frozenHomeCards.current.set(message.id, {
          kind: item.kind,
          slug: item.slug,
        });
      }
    });
    return map;
  }, [cardItems, homeMessages, intelligence, isStreaming, widgetKindFor]);

  // Persist cards on disk only — never setMessages here. Stamping via
  // setMessages looped into React #185; the crash remount then hit #310.
  useEffect(() => {
    if (!opened.current) return;
    const persisted = homeMessages.map((message) => {
      const existing = message.metadata?.homeItem;
      if (
        existing &&
        (existing.kind === 'proposal' || existing.kind === 'signal') &&
        existing.slug
      ) {
        return message;
      }
      const item = cardsByMessageId.get(message.id);
      if (!item) return message;
      return {
        ...message,
        metadata: {
          ...message.metadata,
          homeItem: { kind: item.kind, slug: item.slug },
        },
      };
    });
    writeHomeThread(persisted);
  }, [cardsByMessageId, homeMessages]);

  const cardMessageId = useMemo(() => {
    for (let index = homeMessages.length - 1; index >= 0; index -= 1) {
      const message = homeMessages[index];
      if (!message || message.role !== 'assistant') continue;
      if (message.metadata?.homeArrival) continue;
      if (cardsByMessageId.has(message.id)) return message.id;
    }
    return null;
  }, [cardsByMessageId, homeMessages]);
  const focusedItem = useMemo(() => {
    if (!cardMessageId) return null;
    return cardsByMessageId.get(cardMessageId) ?? null;
  }, [cardMessageId, cardsByMessageId]);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const onScroll = () => {
      if (gliding.current || holdVoiceRef.current) return;
      const gap = node.scrollHeight - node.scrollTop - node.clientHeight;
      pinnedToEnd.current = gap < 120;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    onFocusItem?.(focusedItem);
  }, [focusedItem, onFocusItem]);
  const liveReplyPending = useMemo(() => {
    for (let i = homeMessages.length - 1; i >= 0; i -= 1) {
      const message = homeMessages[i];
      if (!message || message.metadata?.homeArrival) continue;
      if (message.role !== 'assistant') return isStreaming;
      const text = shownAssistantText.get(message.id) ?? '';
      const hasCard = cardsByMessageId.has(message.id);
      // Skeleton only until the first words land — not for the whole stream.
      if (text.trim() || hasCard) return false;
      return isStreaming;
    }
    return isStreaming;
  }, [cardsByMessageId, homeMessages, isStreaming, shownAssistantText]);
  const hasSpoken = homeMessages.some(
    (message) => message.role === 'user' && !message.metadata?.homeArrival,
  );
  const freshStart = threadItems.length === 0 && !hasSpoken;
  const promptName =
    intelligence.person.name?.trim() ||
    intelligence.person.nickname?.trim() ||
    t('fallbackName');
  const orientation = intelligence.person.primaryOrientation;
  const firstPromptLine =
    orientation === 'builder'
      ? t('firstPromptBuilder', { name: promptName })
      : orientation === 'investor'
      ? t('firstPromptInvestor', { name: promptName })
      : t('firstPromptMember', { name: promptName });
  const firstPromptAsk =
    orientation === 'builder'
      ? t('firstPromptAskBuilder')
      : orientation === 'investor'
      ? t('firstPromptAskInvestor')
      : t('firstPromptAskMember');
  const showArrivalMask = useMemo(() => {
    if (freshStart) return false;
    if (error) return false;
    if (liveReplyPending) return true;
    const hasVisible = homeMessages.some((message) => {
      if (message.metadata?.homeArrival) return false;
      if (message.role === 'user') return true;
      return Boolean(messageText(message));
    });
    return !hasVisible;
  }, [error, freshStart, homeMessages, liveReplyPending]);

  for (const message of homeMessages) {
    if (seenMotionIds.current.has(message.id)) continue;
    seenMotionIds.current.add(message.id);
    if (!settleSend.current || message.metadata?.homeArrival) continue;
    settlingIds.current.add(message.id);
    if (message.role === 'assistant') settleSend.current = false;
  }

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;

    if (holdVoiceRef.current) {
      if (gliding.current) return;
      if (arrivalScrollStarted.current) {
        if (arrivalScrollFinished.current && !isStreamingRef.current) {
          holdVoiceRef.current = false;
          arrivalScrollStarted.current = false;
          arrivalScrollFinished.current = false;
          setHoldVoice(false);
        }
        return;
      }
      const target = node.querySelector('[data-home-arrival]');
      if (!target) return;
      arrivalScrollStarted.current = true;
      const top = Math.max(
        0,
        node.scrollTop +
          target.getBoundingClientRect().top -
          node.getBoundingClientRect().top -
          12,
      );
      gliding.current = true;
      glideScrollerTo(
        node,
        top,
        (id) => {
          arrivalFrame.current = id;
        },
        () => {
          arrivalFrame.current = null;
          gliding.current = false;
          arrivalScrollFinished.current = true;
          if (isStreamingRef.current || !holdVoiceRef.current) return;
          holdVoiceRef.current = false;
          arrivalScrollStarted.current = false;
          arrivalScrollFinished.current = false;
          setHoldVoice(false);
        },
      );
      return;
    }

    if (!pinnedToEnd.current || gliding.current) return;
    const top = node.scrollHeight;
    const glide =
      glideScroll.current &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    glideScroll.current = false;
    if (Math.abs(node.scrollTop - top) < 2) return;
    if (glide) {
      gliding.current = true;
      node.scrollTo({ top, behavior: 'smooth' });
      if (glideTimer.current != null) window.clearTimeout(glideTimer.current);
      glideTimer.current = window.setTimeout(() => {
        glideTimer.current = null;
        gliding.current = false;
        const current = scroller.current;
        if (current && pinnedToEnd.current && !holdVoiceRef.current) {
          current.scrollTop = current.scrollHeight;
        }
      }, 520);
      return;
    }
    node.scrollTop = top;
  }, [
    focusedItem,
    holdVoice,
    homeMessages,
    isStreaming,
    showArrivalMask,
    widgets,
  ]);

  useEffect(() => {
    if (!holdVoice || isStreaming || !holdVoiceRef.current) return;
    if (arrivalScrollStarted.current) {
      if (!arrivalScrollFinished.current) return;
      holdVoiceRef.current = false;
      arrivalScrollStarted.current = false;
      arrivalScrollFinished.current = false;
      setHoldVoice(false);
      return;
    }
    const node = scroller.current;
    if (node?.querySelector('[data-home-arrival]')) return;
    holdVoiceRef.current = false;
    setHoldVoice(false);
    if (node) {
      pinnedToEnd.current = true;
      node.scrollTop = node.scrollHeight;
    }
  }, [holdVoice, homeMessages, isStreaming]);

  useEffect(() => {
    return () => {
      if (arrivalFrame.current != null) {
        cancelAnimationFrame(arrivalFrame.current);
      }
      if (glideTimer.current != null) window.clearTimeout(glideTimer.current);
    };
  }, []);

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

  const lastAssistant = [...homeMessages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const visibleError =
    error &&
    !dismissedError &&
    !homeAssistantTurnSucceeded(
      lastAssistant,
      lastAssistant ? messageText(lastAssistant) : '',
      droppedLine.current,
    );

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
          {freshStart ? (
            <article className="flex items-start gap-3">
              <MemberHomeMark className="mt-0.5 h-8 w-8 shrink-0" />
              <p className="text-2 leading-relaxed text-foreground">
                {firstPromptLine}
              </p>
            </article>
          ) : null}
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
            const text =
              message.role === 'assistant'
                ? shownAssistantText.get(message.id) ?? ''
                : rawText;
            const pinnedItem =
              message.role === 'assistant'
                ? cardsByMessageId.get(message.id) ?? null
                : null;
            const visuals =
              message.role === 'assistant'
                ? generatedVisualsFromParts(message.parts)
                : null;
            const keepsCard = pinnedItem != null;
            const replyReady =
              message.role !== 'assistant' ||
              memberHomeReplyReady({
                text,
                hasCard: keepsCard || Boolean(visuals),
                streaming:
                  isStreaming &&
                  message.id === homeMessages[homeMessages.length - 1]?.id,
              });
            const showMessage =
              replyReady &&
              ((!message.metadata?.homeArrival && Boolean(text)) ||
                keepsCard ||
                Boolean(visuals));
            if (!replyReady || (!showMessage && attached.length === 0)) {
              return null;
            }
            const mine = message.role === 'user';
            const arriving =
              holdVoice &&
              message.role === 'assistant' &&
              !arrivalBaselineIds.current.has(message.id);
            const oneLine =
              text.length > 0 &&
              !visuals &&
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
                    data-home-arrival={
                      arriving &&
                      (pinnedItem || (!isStreaming && Boolean(text)))
                        ? ''
                        : undefined
                    }
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
                          {homeMessageNodes(text)}
                        </p>
                      ) : null}
                      {visuals ? (
                        <div className="grid gap-3">
                          {visuals.logoUrl ? (
                            <img
                              src={visuals.logoUrl}
                              alt={t('generatedLogo')}
                              className="h-24 w-24 border border-border object-cover"
                            />
                          ) : null}
                          {visuals.bannerUrl ? (
                            <img
                              src={visuals.bannerUrl}
                              alt={t('generatedBanner')}
                              className="w-full max-w-md border border-border object-cover"
                              style={{ maxHeight: 160 }}
                            />
                          ) : null}
                        </div>
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
                          done={actedKeySet.has(
                            memberHomeThreadItemKey(pinnedItem),
                          )}
                          proposal={
                            pinnedItem.kind === 'proposal'
                              ? intelligence.proposals.find(
                                  (proposal) =>
                                    proposal.slug === pinnedItem.slug,
                                ) ?? null
                              : null
                          }
                          onSettled={() => {
                            voiceInterview.stopSpeaking();
                          }}
                          onAsk={(ask, hidden) => {
                            if (hidden) {
                              if (glideTimer.current != null) {
                                window.clearTimeout(glideTimer.current);
                                glideTimer.current = null;
                              }
                              if (arrivalFrame.current != null) {
                                cancelAnimationFrame(arrivalFrame.current);
                                arrivalFrame.current = null;
                              }
                              gliding.current = false;
                              pinnedToEnd.current = false;
                              arrivalBaselineIds.current = new Set(
                                messagesRef.current.map((entry) => entry.id),
                              );
                              arrivalScrollStarted.current = false;
                              arrivalScrollFinished.current = false;
                              holdVoiceRef.current = true;
                              setHoldVoice(true);
                            }
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
                        personId={intelligence.person.id}
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
          <MemberHomeOnboardingCards
            messages={homeMessages}
            isStreaming={isStreaming}
            onSend={(text) => {
              void send(text);
            }}
          />
          {showArrivalMask ? (
            <article
              className="flex items-start gap-3"
              aria-live="polite"
              aria-busy="true"
            >
              <MemberHomeMark className="mt-0.5 h-8 w-8 shrink-0" />
              <div className="grid min-w-0 flex-1 gap-4">
                <div className="grid gap-2">
                  <HomeWave className="h-3 w-11/12" delayMs={40} />
                  <HomeWave className="h-3 w-4/5" delayMs={90} />
                  <HomeWave className="h-3 w-2/3" delayMs={140} />
                </div>
                <div className="border border-border bg-background p-3">
                  <HomeWave
                    className="w-full"
                    delayMs={80}
                    style={{ height: 56 }}
                  />
                  <HomeWave className="mt-3 h-4 w-1/2" delayMs={150} />
                  <HomeWave className="mt-2 h-3 w-2/5" delayMs={200} />
                  <div className="mt-4 flex gap-2">
                    <HomeWave className="h-10 w-28" delayMs={240} />
                    <HomeWave className="h-10 w-24" delayMs={290} />
                  </div>
                </div>
              </div>
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
        <div className="narrow-scrollbar mx-5 mb-2 flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto pt-2 md:mx-4">
          {freshStart ? (
            <button
              type="button"
              disabled={isStreaming}
              className="shrink-0 rounded-none border border-foreground bg-foreground px-3 py-2 text-[11px] font-medium leading-none whitespace-nowrap text-background disabled:opacity-50"
              onClick={() => {
                void send(firstPromptAsk);
              }}
            >
              {firstPromptAsk}
            </button>
          ) : null}
          {chips
            .filter((chip) => !freshStart || chip.ask !== firstPromptAsk)
            .map((chip) => (
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
