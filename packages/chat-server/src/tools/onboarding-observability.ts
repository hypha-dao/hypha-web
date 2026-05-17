type OnboardingToolEventStatus =
  | 'proposed'
  | 'confirmed'
  | 'executed'
  | 'failed';

type OnboardingToolEvent = {
  tool: string;
  status: OnboardingToolEventStatus;
  actorSub?: string;
  spaceSlug?: string;
  dedupeKey?: string;
  details?: Record<string, unknown>;
  error?: string;
};

export function logOnboardingToolEvent(event: OnboardingToolEvent): void {
  const payload = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  if (event.status === 'failed') {
    console.error('[chat][onboarding-tool]', payload);
    return;
  }
  console.log('[chat][onboarding-tool]', payload);
}
