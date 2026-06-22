'use client';

import type { OnboardingDiscoveryMode } from './onboarding-discovery-mode';
import { parseOnboardingDiscoveryMode } from './onboarding-discovery-mode';

export type { OnboardingDiscoveryMode };
export const ONBOARDING_SETUP_MODE = 'onboarding_setup' as const;
export const AI_PANEL_SETUP_SOURCE = 'ai_panel' as const;
export const ONBOARDING_HERO_SOURCE = 'onboarding_hero' as const;
export const AI_ONBOARDING_SEED_EVENT = 'hypha:ai-onboarding-seed';
export const AI_ONBOARDING_SEED_ACK_EVENT = 'hypha:ai-onboarding-seed-ack';
const ONBOARDING_CHAT_MESSAGES_STORAGE_KEY =
  'hypha:onboarding-chat-messages:v1';
const ONBOARDING_OPEN_AI_PANEL_KEY = 'hypha:onboarding-open-ai-panel:v1';
const ONBOARDING_CONTINUATION_PROMPT_KEY =
  'hypha:onboarding-continuation-prompt:v1';

export type StoredOnboardingChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<{ type: string; [key: string]: unknown }>;
};

export type OnboardingSpaceLocation = {
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  locationSource: 'geocode' | 'manual' | 'map_click' | null;
  skipped?: boolean;
};

export type OnboardingActivationMethod = 'sandbox' | 'pilot' | 'deployment';

export type OnboardingSetupJourney = 'single_space' | 'ecosystem';

export type OnboardingTransparencyMatrix = {
  discoverability: 0 | 1 | 2 | 3;
  access: 0 | 1 | 2 | 3;
};

export type OnboardingEntryMethod =
  | 'open_access'
  | 'invite_only'
  | 'token_based';

export type OnboardingConversationContext = {
  mode: typeof ONBOARDING_SETUP_MODE;
  source: typeof ONBOARDING_HERO_SOURCE | typeof AI_PANEL_SETUP_SOURCE;
  firstName?: string;
  setupPhase?: 'discover' | 'draft' | 'confirm' | 'execute' | 'verify';
  spaceLocation?: OnboardingSpaceLocation;
  activationMethod?: OnboardingActivationMethod;
  setupJourney?: OnboardingSetupJourney;
  transparencyMatrix?: OnboardingTransparencyMatrix;
  entryMethod?: OnboardingEntryMethod;
  /** Root space slug after ecosystem onboarding handoff to the left AI panel. */
  ecosystemRootSlug?: string;
  /** Chat text vs voice interview during discovery. */
  discoveryMode?: OnboardingDiscoveryMode;
  setupPlan?: {
    spaceIntent?: {
      title?: string;
      purpose?: string;
      audience?: string;
    };
    governance?: {
      transparency?: string;
      entryMethod?: string;
      votingModel?: string;
    };
    tokenSetup?: {
      needsToken?: boolean;
      treasuryIntent?: string;
    };
    proposalQueue?: Array<{
      title: string;
      status: 'drafted' | 'submitted' | 'onVoting' | 'accepted' | 'rejected';
    }>;
    ecosystemBlueprint?: Array<{
      key: string;
      role: string;
      title: string;
      status: 'planned' | 'confirmed' | 'created';
    }>;
  };
  lastUserText?: string;
  locale?: string;
  createdAt: string;
};

type SeedEventDetail = {
  prompt: string;
  context: OnboardingConversationContext;
  attachments?: File[];
};
type SeedAckEventDetail = {
  ok?: boolean;
  stage?: 'received' | 'sending' | 'sent' | 'error';
  reason?: string;
};

const ONBOARDING_CONTEXT_STORAGE_KEY = 'hypha:ai-onboarding-context:v1';

function parseStoredCoordinate(
  value: unknown,
  min: number,
  max: number,
): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

function parseStoredSpaceLocation(
  raw: unknown,
): OnboardingSpaceLocation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Partial<OnboardingSpaceLocation>;
  if (
    candidate.latitude === undefined &&
    candidate.longitude === undefined &&
    candidate.skipped !== true
  ) {
    return undefined;
  }
  return {
    latitude: parseStoredCoordinate(candidate.latitude, -90, 90),
    longitude: parseStoredCoordinate(candidate.longitude, -180, 180),
    locationLabel:
      typeof candidate.locationLabel === 'string'
        ? candidate.locationLabel
        : candidate.locationLabel === null
        ? null
        : null,
    locationSource:
      candidate.locationSource === 'geocode' ||
      candidate.locationSource === 'manual' ||
      candidate.locationSource === 'map_click'
        ? candidate.locationSource
        : candidate.locationSource === null
        ? null
        : null,
    skipped: candidate.skipped === true,
  };
}

function parseStoredTransparencyMatrix(
  raw: unknown,
): OnboardingTransparencyMatrix | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Partial<OnboardingTransparencyMatrix>;
  const discoverability = candidate.discoverability;
  const access = candidate.access;
  if (
    typeof discoverability !== 'number' ||
    discoverability < 0 ||
    discoverability > 3 ||
    typeof access !== 'number' ||
    access < 0 ||
    access > 3
  ) {
    return undefined;
  }
  return {
    discoverability: discoverability as 0 | 1 | 2 | 3,
    access: access as 0 | 1 | 2 | 3,
  };
}

function parseStoredActivationMethod(
  raw: unknown,
): OnboardingActivationMethod | undefined {
  if (raw === 'sandbox' || raw === 'pilot' || raw === 'deployment') {
    return raw;
  }
  return undefined;
}

function parseStoredSetupJourney(
  raw: unknown,
): OnboardingSetupJourney | undefined {
  if (raw === 'single_space' || raw === 'ecosystem') {
    return raw;
  }
  return undefined;
}

function parseStoredEntryMethod(
  raw: unknown,
): OnboardingEntryMethod | undefined {
  if (raw === 'open_access' || raw === 'invite_only' || raw === 'token_based') {
    return raw;
  }
  return undefined;
}

function parseStoredSource(
  raw: unknown,
): OnboardingConversationContext['source'] {
  if (raw === AI_PANEL_SETUP_SOURCE) return AI_PANEL_SETUP_SOURCE;
  return ONBOARDING_HERO_SOURCE;
}

export function createAiPanelSetupContext(
  locale?: string,
): OnboardingConversationContext {
  return {
    mode: ONBOARDING_SETUP_MODE,
    source: AI_PANEL_SETUP_SOURCE,
    setupPhase: 'discover',
    createdAt: new Date().toISOString(),
    ...(locale ? { locale } : {}),
  };
}

export function isSpaceSetupContext(
  context: OnboardingConversationContext | undefined,
): context is OnboardingConversationContext {
  return context?.mode === ONBOARDING_SETUP_MODE;
}

export function ensureSpaceSetupContext(
  context: OnboardingConversationContext | undefined,
  locale?: string,
): OnboardingConversationContext {
  if (isSpaceSetupContext(context)) return context;
  return createAiPanelSetupContext(locale);
}

export function shouldEnterSpaceSetupFromUserText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (
    /\b(full ecosystem|multiple spaces|single space|organisation blueprint|organization blueprint)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  const wantsSetup = /\b(create|set up|setup|start|launch|build|new)\b/.test(
    normalized,
  );
  const setupTarget =
    /\b(space|spaces|organisation|organization|ecosystem|dao|dho|org)\b/.test(
      normalized,
    );
  return wantsSetup && setupTarget;
}

export function resolveSetupContextForUserMessage(
  text: string,
  current: OnboardingConversationContext | undefined,
  locale?: string,
): OnboardingConversationContext | undefined {
  if (isSpaceSetupContext(current)) {
    return text.trim()
      ? applyOnboardingContextForUserText(current, text)
      : current;
  }
  if (!shouldEnterSpaceSetupFromUserText(text)) {
    return current;
  }
  const base = createAiPanelSetupContext(locale);
  return text.trim() ? applyOnboardingContextForUserText(base, text) : base;
}

export function readOnboardingConversationContext():
  | OnboardingConversationContext
  | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_CONTEXT_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<OnboardingConversationContext>;
    if (
      !parsed ||
      parsed.mode !== ONBOARDING_SETUP_MODE ||
      typeof parsed.createdAt !== 'string'
    ) {
      return undefined;
    }
    const source = parseStoredSource(parsed.source);
    const parsedSpaceLocation = parseStoredSpaceLocation(parsed.spaceLocation);
    return {
      mode: ONBOARDING_SETUP_MODE,
      source,
      firstName:
        typeof parsed.firstName === 'string' ? parsed.firstName : undefined,
      setupPhase:
        parsed.setupPhase === 'discover' ||
        parsed.setupPhase === 'draft' ||
        parsed.setupPhase === 'confirm' ||
        parsed.setupPhase === 'execute' ||
        parsed.setupPhase === 'verify'
          ? parsed.setupPhase
          : 'discover',
      setupPlan:
        parsed.setupPlan && typeof parsed.setupPlan === 'object'
          ? (parsed.setupPlan as OnboardingConversationContext['setupPlan'])
          : undefined,
      spaceLocation: parsedSpaceLocation,
      activationMethod: parseStoredActivationMethod(parsed.activationMethod),
      setupJourney: parseStoredSetupJourney(parsed.setupJourney),
      transparencyMatrix: parseStoredTransparencyMatrix(
        parsed.transparencyMatrix,
      ),
      entryMethod: parseStoredEntryMethod(parsed.entryMethod),
      ecosystemRootSlug:
        typeof parsed.ecosystemRootSlug === 'string'
          ? parsed.ecosystemRootSlug
          : undefined,
      discoveryMode: parseOnboardingDiscoveryMode(parsed.discoveryMode),
      lastUserText:
        typeof parsed.lastUserText === 'string'
          ? parsed.lastUserText
          : undefined,
      locale: typeof parsed.locale === 'string' ? parsed.locale : undefined,
      createdAt: parsed.createdAt,
    };
  } catch {
    return undefined;
  }
}

export function saveOnboardingConversationContext(
  context: OnboardingConversationContext,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    ONBOARDING_CONTEXT_STORAGE_KEY,
    JSON.stringify(context),
  );
}

export function clearOnboardingConversationContext(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ONBOARDING_CONTEXT_STORAGE_KEY);
}

function sanitizeOnboardingChatMessageForStorage(
  message: StoredOnboardingChatMessage,
): StoredOnboardingChatMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts?.map((part) => {
      if (part.type === 'file') {
        return { type: 'text', text: '[Uploaded file]' };
      }
      return part;
    }),
  };
}

export function saveOnboardingChatMessages(
  messages: StoredOnboardingChatMessage[],
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      ONBOARDING_CHAT_MESSAGES_STORAGE_KEY,
      JSON.stringify(messages.map(sanitizeOnboardingChatMessageForStorage)),
    );
  } catch {
    // Ignore quota errors — context handoff still works without full history.
  }
}

export function readOnboardingChatMessages():
  | StoredOnboardingChatMessage[]
  | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(
      ONBOARDING_CHAT_MESSAGES_STORAGE_KEY,
    );
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

export function clearOnboardingChatMessages(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ONBOARDING_CHAT_MESSAGES_STORAGE_KEY);
}

export function markOnboardingOpenAiPanelPending(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ONBOARDING_OPEN_AI_PANEL_KEY, 'true');
}

export function consumeOnboardingOpenAiPanelPending(): boolean {
  if (typeof window === 'undefined') return false;
  const pending =
    window.sessionStorage.getItem(ONBOARDING_OPEN_AI_PANEL_KEY) === 'true';
  if (pending) {
    window.sessionStorage.removeItem(ONBOARDING_OPEN_AI_PANEL_KEY);
  }
  return pending;
}

export function saveOnboardingContinuationPrompt(prompt: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = prompt.trim();
  if (!trimmed) return;
  window.sessionStorage.setItem(ONBOARDING_CONTINUATION_PROMPT_KEY, trimmed);
}

export function consumeOnboardingContinuationPrompt(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const prompt = window.sessionStorage.getItem(
    ONBOARDING_CONTINUATION_PROMPT_KEY,
  );
  if (prompt) {
    window.sessionStorage.removeItem(ONBOARDING_CONTINUATION_PROMPT_KEY);
    return prompt.trim() || undefined;
  }
  return undefined;
}

/** Persist onboarding chat + context and open the left AI panel on the next page. */
export function handoffOnboardingToAiPanel({
  messages,
  context,
  continuationPrompt,
}: {
  messages: StoredOnboardingChatMessage[];
  context: OnboardingConversationContext;
  continuationPrompt?: string;
}): void {
  saveOnboardingChatMessages(messages);
  saveOnboardingConversationContext(context);
  markOnboardingOpenAiPanelPending();
  if (continuationPrompt?.trim()) {
    saveOnboardingContinuationPrompt(continuationPrompt);
  }
}

/** First screen after onboarding space creation (ecosystem map vs signals board). */
export function getPostOnboardingLandingPath(
  lang: string,
  slug: string,
  setupJourney?: OnboardingSetupJourney,
): string {
  const locale = lang.trim() || 'en';
  const safeSlug = slug.trim();
  if (setupJourney === 'ecosystem') {
    return `/${locale}/dho/${safeSlug}/ecosystem-navigation`;
  }
  return `/${locale}/dho/${safeSlug}/coherence`;
}

/** Auto-continue AI discovery after landing on the new space. */
export function getPostOnboardingContinuationPrompt(
  setupJourney?: OnboardingSetupJourney,
): string | undefined {
  if (setupJourney === 'ecosystem') {
    return `Our root space is live. Based on everything we discussed during onboarding, propose 3–4 child spaces that would complete this organisation—each with a clear role and purpose. We'll create them one by one together.`;
  }
  if (setupJourney === 'single_space') {
    return `Our space is live. Based on our onboarding conversation, propose one strong first signal—what it should focus on, its type and priority, and why it matters right now. Use get_signals_by_space_slug for context, then help me create it when you're ready.`;
  }
  return undefined;
}

export function isPlainOnboardingConfirmationReply(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  const normalizedCompact = normalized
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;
  if (/^confirm\b/.test(normalized) || /^confirm\b/.test(normalizedCompact)) {
    return true;
  }
  const affirmatives = new Set([
    'yes',
    'y',
    'yep',
    'yeah',
    'sure',
    'ok',
    'okay',
    'ready',
    'go ahead',
    'proceed',
    'do it',
    'yes, proceed',
    'yes proceed',
    'sounds good',
    'prompt signature',
    'sign',
    'signed',
    'already did',
    'done',
  ]);
  return affirmatives.has(normalized) || affirmatives.has(normalizedCompact);
}

export function applyOnboardingContextForUserText(
  context: OnboardingConversationContext,
  text: string,
): OnboardingConversationContext {
  const normalized = text.trim();
  const isExplicitConfirmation = isPlainOnboardingConfirmationReply(normalized);
  return {
    ...context,
    lastUserText: normalized,
    setupPhase: isExplicitConfirmation
      ? 'confirm'
      : context.setupPhase === 'discover'
      ? 'draft'
      : context.setupPhase,
  };
}

export function dispatchAiOnboardingSeed(detail: SeedEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SeedEventDetail>(AI_ONBOARDING_SEED_EVENT, {
      detail,
    }),
  );
}

export function dispatchAiOnboardingSeedAck(detail: SeedAckEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SeedAckEventDetail>(AI_ONBOARDING_SEED_ACK_EVENT, {
      detail,
    }),
  );
}
