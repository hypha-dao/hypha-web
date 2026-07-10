'use client';

import type { OnboardingDiscoveryMode } from './onboarding-discovery-mode';
import { parseOnboardingDiscoveryMode } from './onboarding-discovery-mode';
import { transferMobilizedAiAgentsToSpace } from './ai-agent-competencies';
import { shouldAttachOnboardingContext } from './onboarding-context-attach';
import { isOnboardingWalletSessionActive } from './onboarding-wallet-handoff';
import type { ActiveProposalFormSnapshotPayload } from './active-proposal-form-snapshot';

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

export type OnboardingTransparencyLevel = 0 | 1 | 2 | 3;

export type OnboardingEntryMethod =
  | 'open_access'
  | 'invite_only'
  | 'token_based';

export type OnboardingVotingMethod = '1m1v' | '1v1v' | '1t1v';

export type ActiveGovernanceProposalType =
  | 'change_voting_method'
  | 'change_entry_method';

export type ActiveGovernanceProposal = {
  proposalType: ActiveGovernanceProposalType;
  collectedFields: Record<string, unknown>;
  formOpen?: boolean;
};

export type OnboardingConversationContext = {
  mode: typeof ONBOARDING_SETUP_MODE;
  source: typeof ONBOARDING_HERO_SOURCE | typeof AI_PANEL_SETUP_SOURCE;
  firstName?: string;
  setupPhase?: 'discover' | 'draft' | 'confirm' | 'execute' | 'verify';
  spaceLocation?: OnboardingSpaceLocation;
  activationMethod?: OnboardingActivationMethod;
  setupJourney?: OnboardingSetupJourney;
  transparencyMatrix?: OnboardingTransparencyMatrix;
  /** Discoverability chosen in step 1 before activity access is confirmed. */
  pendingTransparencyDiscoverability?: OnboardingTransparencyLevel;
  entryMethod?: OnboardingEntryMethod;
  /** Governance voting model chosen during post-create verify phase. */
  votingMethod?: OnboardingVotingMethod;
  /** In-progress governance proposal walkthrough (form may be open). */
  activeGovernanceProposal?: ActiveGovernanceProposal;
  /** Root space slug after ecosystem onboarding handoff to the left AI panel. */
  ecosystemRootSlug?: string;
  /** Slug of the space created during onboarding (single-space or ecosystem root). */
  createdSpaceSlug?: string;
  /** Browser session: user completed at least one wallet/2FA sign this tab session. */
  walletSessionActive?: boolean;
  /** Confirmed logo + hero banner URLs from upload or generation. */
  visualAssets?: {
    logoUrl: string;
    leadImageUrl: string;
  };
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

function spaceLocationForLocalStorage(
  location: OnboardingSpaceLocation | undefined,
): OnboardingSpaceLocation | undefined {
  if (!location) return undefined;
  return {
    ...location,
    latitude: null,
    longitude: null,
  };
}

function parseStoredTransparencyLevel(
  raw: unknown,
): OnboardingTransparencyLevel | undefined {
  if (typeof raw !== 'number' || raw < 0 || raw > 3) return undefined;
  return raw as OnboardingTransparencyLevel;
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

function parseStoredVotingMethod(
  raw: unknown,
): OnboardingVotingMethod | undefined {
  if (raw === '1m1v' || raw === '1v1v' || raw === '1t1v') {
    return raw;
  }
  return undefined;
}

export function isPostCreateOnboardingPhase(
  context: OnboardingConversationContext | undefined,
): boolean {
  return context?.setupPhase === 'verify' || context?.setupPhase === 'execute';
}

function parseStoredSource(
  raw: unknown,
): OnboardingConversationContext['source'] {
  if (raw === AI_PANEL_SETUP_SOURCE) return AI_PANEL_SETUP_SOURCE;
  return ONBOARDING_HERO_SOURCE;
}

function parseStoredVisualAssets(
  raw: unknown,
): OnboardingConversationContext['visualAssets'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as {
    logoUrl?: unknown;
    leadImageUrl?: unknown;
  };
  if (
    typeof candidate.logoUrl !== 'string' ||
    typeof candidate.leadImageUrl !== 'string' ||
    !/^https?:\/\//i.test(candidate.logoUrl.trim()) ||
    !/^https?:\/\//i.test(candidate.leadImageUrl.trim())
  ) {
    return undefined;
  }
  return {
    logoUrl: candidate.logoUrl.trim(),
    leadImageUrl: candidate.leadImageUrl.trim(),
  };
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

function parseStoredActiveGovernanceProposal(
  raw: unknown,
): ActiveGovernanceProposal | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Partial<ActiveGovernanceProposal>;
  if (
    candidate.proposalType !== 'change_voting_method' &&
    candidate.proposalType !== 'change_entry_method'
  ) {
    return undefined;
  }
  const collectedFields =
    candidate.collectedFields &&
    typeof candidate.collectedFields === 'object' &&
    !Array.isArray(candidate.collectedFields)
      ? (candidate.collectedFields as Record<string, unknown>)
      : {};
  return {
    proposalType: candidate.proposalType,
    collectedFields,
    formOpen: candidate.formOpen === true,
  };
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
      pendingTransparencyDiscoverability: parseStoredTransparencyLevel(
        parsed.pendingTransparencyDiscoverability,
      ),
      entryMethod: parseStoredEntryMethod(parsed.entryMethod),
      votingMethod:
        parseStoredVotingMethod(parsed.votingMethod) ??
        parseStoredVotingMethod(parsed.setupPlan?.governance?.votingModel),
      activeGovernanceProposal: parseStoredActiveGovernanceProposal(
        parsed.activeGovernanceProposal,
      ),
      ecosystemRootSlug:
        typeof parsed.ecosystemRootSlug === 'string'
          ? parsed.ecosystemRootSlug
          : undefined,
      createdSpaceSlug:
        typeof parsed.createdSpaceSlug === 'string'
          ? parsed.createdSpaceSlug
          : undefined,
      visualAssets: parseStoredVisualAssets(parsed.visualAssets),
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
    JSON.stringify({
      ...context,
      spaceLocation: spaceLocationForLocalStorage(context.spaceLocation),
    }),
  );
}

export function clearOnboardingConversationContext(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ONBOARDING_CONTEXT_STORAGE_KEY);
}

export { shouldAttachOnboardingContext } from './onboarding-context-attach';
export { shouldBypassSpaceMembershipForOnboarding } from './onboarding-context-attach';

/** Strip client-only fields and invalid setupPlan entries before POST /api/chat. */
export function serializeConversationContextForChatApi(
  context: OnboardingConversationContext,
  options?: { discoveryMode?: OnboardingDiscoveryMode },
): OnboardingConversationContext {
  const discoveryMode = options?.discoveryMode ?? context.discoveryMode;
  return {
    mode: ONBOARDING_SETUP_MODE,
    source: context.source ?? ONBOARDING_HERO_SOURCE,
    ...(context.setupPhase ? { setupPhase: context.setupPhase } : {}),
    ...(context.setupPlan ? { setupPlan: context.setupPlan } : {}),
    ...(context.spaceLocation ? { spaceLocation: context.spaceLocation } : {}),
    ...(context.activationMethod
      ? { activationMethod: context.activationMethod }
      : {}),
    ...(context.setupJourney ? { setupJourney: context.setupJourney } : {}),
    ...(context.transparencyMatrix
      ? { transparencyMatrix: context.transparencyMatrix }
      : {}),
    ...(context.pendingTransparencyDiscoverability !== undefined
      ? {
          pendingTransparencyDiscoverability:
            context.pendingTransparencyDiscoverability,
        }
      : {}),
    ...(context.entryMethod ? { entryMethod: context.entryMethod } : {}),
    ...(context.votingMethod ? { votingMethod: context.votingMethod } : {}),
    ...(context.activeGovernanceProposal
      ? { activeGovernanceProposal: context.activeGovernanceProposal }
      : {}),
    ...(context.ecosystemRootSlug
      ? { ecosystemRootSlug: context.ecosystemRootSlug }
      : {}),
    ...(context.createdSpaceSlug
      ? { createdSpaceSlug: context.createdSpaceSlug }
      : {}),
    ...(context.walletSessionActive ? { walletSessionActive: true } : {}),
    ...(context.visualAssets ? { visualAssets: context.visualAssets } : {}),
    ...(discoveryMode ? { discoveryMode } : {}),
    ...(context.lastUserText ? { lastUserText: context.lastUserText } : {}),
    ...(context.locale ? { locale: context.locale } : {}),
    createdAt: context.createdAt,
  };
}

/** Resolve chat API body fields and whether persisted onboarding context is stale. */
export function resolveChatTransportBody({
  spaceSlug,
  activeSpaceTitle,
  onboardingContext,
  isOnboardingPath,
  discoveryMode,
  activeProposalFormSnapshot,
  locale,
}: {
  spaceSlug?: string;
  activeSpaceTitle?: string;
  onboardingContext?: OnboardingConversationContext;
  isOnboardingPath: boolean;
  discoveryMode?: OnboardingDiscoveryMode;
  activeProposalFormSnapshot?: ActiveProposalFormSnapshotPayload;
  locale?: string;
}): {
  body: {
    spaceSlug?: string;
    activeSpaceTitle?: string;
    conversationContext?: OnboardingConversationContext;
    discoveryMode?: OnboardingDiscoveryMode;
    activeProposalFormSnapshot?: ActiveProposalFormSnapshotPayload;
    locale?: string;
  };
  staleOnboardingContext: boolean;
} {
  const trimmedSlug = spaceSlug?.trim() || undefined;
  const trimmedTitle = activeSpaceTitle?.trim() || undefined;
  const trimmedLocale = locale?.trim() || undefined;
  const localePayload = trimmedLocale ? { locale: trimmedLocale } : {};
  const discoveryModePayload =
    discoveryMode === 'voice_interview' ? discoveryMode : undefined;
  const snapshotPayload = activeProposalFormSnapshot
    ? { activeProposalFormSnapshot }
    : {};

  if (!isSpaceSetupContext(onboardingContext)) {
    return {
      body: {
        ...(trimmedSlug ? { spaceSlug: trimmedSlug } : {}),
        ...(trimmedTitle ? { activeSpaceTitle: trimmedTitle } : {}),
        ...(discoveryModePayload
          ? { discoveryMode: discoveryModePayload }
          : {}),
        ...localePayload,
        ...snapshotPayload,
      },
      staleOnboardingContext: false,
    };
  }

  const attach = shouldAttachOnboardingContext(onboardingContext, {
    spaceSlug: trimmedSlug,
    isOnboardingPath,
  });

  if (!attach) {
    return {
      body: {
        ...(trimmedSlug ? { spaceSlug: trimmedSlug } : {}),
        ...(trimmedTitle ? { activeSpaceTitle: trimmedTitle } : {}),
        ...(discoveryModePayload
          ? { discoveryMode: discoveryModePayload }
          : {}),
        ...localePayload,
        ...snapshotPayload,
      },
      staleOnboardingContext: true,
    };
  }

  const {
    walletSessionActive: _staleWalletSession,
    ...onboardingWithoutWalletSession
  } = onboardingContext ?? {};

  return {
    body: {
      ...(trimmedSlug ? { spaceSlug: trimmedSlug } : {}),
      ...(trimmedTitle ? { activeSpaceTitle: trimmedTitle } : {}),
      conversationContext: serializeConversationContextForChatApi(
        {
          ...onboardingWithoutWalletSession,
          ...(isOnboardingWalletSessionActive()
            ? { walletSessionActive: true }
            : {}),
        },
        { discoveryMode },
      ),
      ...(discoveryModePayload ? { discoveryMode: discoveryModePayload } : {}),
      ...localePayload,
      ...snapshotPayload,
    },
    staleOnboardingContext: false,
  };
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
  const postCreateHandoff = isPostCreateOnboardingPhase(context);
  if (postCreateHandoff) {
    clearOnboardingChatMessages();
  } else {
    saveOnboardingChatMessages(messages);
  }
  saveOnboardingConversationContext(context);
  const createdSlug =
    context.createdSpaceSlug?.trim() || context.ecosystemRootSlug?.trim();
  if (createdSlug) {
    transferMobilizedAiAgentsToSpace(createdSlug, {
      messages: postCreateHandoff ? [] : messages,
    });
  }
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
  ecosystemBlueprint?: Array<{
    key: string;
    role: string;
    title: string;
    status: 'planned' | 'confirmed' | 'created';
  }>,
  rootSlug?: string,
): string | undefined {
  if (setupJourney === 'ecosystem') {
    const pending =
      ecosystemBlueprint?.filter((entry) => entry.status !== 'created') ?? [];
    const rootLabel = rootSlug?.trim() ? `"${rootSlug.trim()}"` : 'is live';
    if (pending.length > 0) {
      const first = pending[0]!;
      return `Our root space ${rootLabel}. Continue the ecosystem blueprint from onboarding in the left panel. Start with the first pending nested space: "${
        first.title
      }" (${first.role.replace(
        /_/g,
        ' ',
      )}). Propose it warmly in one short message, get my confirmation, then create it with create_ecosystem_space under the root. Work through remaining nested spaces one by one—do not restart discovery or list every space as a numbered checklist.`;
    }
    return `Our root space ${rootLabel}. Propose the first nested space that would complete this organisation based on our onboarding conversation—one clear role and purpose. We'll create nested spaces one at a time in the left panel. Do not list multiple spaces as a numbered checklist.`;
  }
  if (setupJourney === 'single_space') {
    return `Our space is live. Let's finish setup: first help me choose our voting method, then confirm entry method if we skipped it earlier. Use the cards in the panel when available and guide me step by step.`;
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
    'oui',
    'ouais',
    'si',
    'sí',
    'sim',
    'ja',
    'genau',
    "d'accord",
    'dacord',
    'bien sûr',
    'bien sur',
    'parfait',
    'vale',
    'claro',
    'certo',
    'de acuerdo',
    'einverstanden',
  ]);
  return (
    affirmatives.has(normalized) ||
    affirmatives.has(normalizedCompact) ||
    /^(?:yes|yep|yeah|sure|ok|okay|sounds good|go ahead|proceed|do it|oui|ouais|si|sí|sim|ja|genau|d'accord|dacord|bien sûr|bien sur|parfait|vale|claro|certo|de acuerdo|einverstanden)\b/.test(
      normalizedCompact,
    )
  );
}

function inferSetupJourneyFromUserText(
  text: string,
): OnboardingSetupJourney | undefined {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return undefined;
  if (
    normalized.includes('full ecosystem') ||
    normalized.includes('multiple spaces') ||
    normalized.includes('full organisation') ||
    normalized.includes('full organization')
  ) {
    return 'ecosystem';
  }
  if (
    normalized.includes('single space') ||
    normalized === 'single' ||
    normalized.includes('one space')
  ) {
    return 'single_space';
  }
  return undefined;
}

export function applyOnboardingContextForUserText(
  context: OnboardingConversationContext,
  text: string,
): OnboardingConversationContext {
  const normalized = text.trim();
  const isExplicitConfirmation = isPlainOnboardingConfirmationReply(normalized);
  const inferredJourney =
    context.setupJourney ?? inferSetupJourneyFromUserText(normalized);
  return {
    ...context,
    lastUserText: normalized,
    ...(inferredJourney ? { setupJourney: inferredJourney } : {}),
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
