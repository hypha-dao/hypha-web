'use client';

export const ONBOARDING_SETUP_MODE = 'onboarding_setup' as const;
export const AI_ONBOARDING_SEED_EVENT = 'hypha:ai-onboarding-seed';
export const AI_ONBOARDING_SEED_ACK_EVENT = 'hypha:ai-onboarding-seed-ack';

export type OnboardingConversationContext = {
  mode: typeof ONBOARDING_SETUP_MODE;
  source: 'onboarding_hero';
  setupPhase?: 'discover' | 'draft' | 'confirm' | 'execute' | 'verify';
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
    return {
      mode: ONBOARDING_SETUP_MODE,
      source: 'onboarding_hero',
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
