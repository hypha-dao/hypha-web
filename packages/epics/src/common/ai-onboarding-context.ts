'use client';

export const ONBOARDING_SETUP_MODE = 'onboarding_setup' as const;
export const AI_ONBOARDING_SEED_EVENT = 'hypha:ai-onboarding-seed';
export const AI_ONBOARDING_SEED_ACK_EVENT = 'hypha:ai-onboarding-seed-ack';

export type OnboardingSpaceLocation = {
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  locationSource: 'geocode' | 'manual' | 'map_click' | null;
  skipped?: boolean;
};

export type OnboardingConversationContext = {
  mode: typeof ONBOARDING_SETUP_MODE;
  source: 'onboarding_hero';
  firstName?: string;
  setupPhase?: 'discover' | 'draft' | 'confirm' | 'execute' | 'verify';
  spaceLocation?: OnboardingSpaceLocation;
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
    latitude:
      typeof candidate.latitude === 'number'
        ? candidate.latitude
        : candidate.latitude === null
        ? null
        : null,
    longitude:
      typeof candidate.longitude === 'number'
        ? candidate.longitude
        : candidate.longitude === null
        ? null
        : null,
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
      parsed.source !== 'onboarding_hero' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return undefined;
    }
    const parsedSpaceLocation = parseStoredSpaceLocation(parsed.spaceLocation);
    return {
      mode: ONBOARDING_SETUP_MODE,
      source: 'onboarding_hero',
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
