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

const ONBOARDING_TOOL_LOG_SCOPE = '[chat][onboarding-tool]';

export function logOnboardingToolEvent(event: OnboardingToolEvent): void {
  const normalizedEvent =
    event.status === 'failed' && !event.error?.trim()
      ? { ...event, error: 'unknown_failure' }
      : event;
  const payload = {
    scope: ONBOARDING_TOOL_LOG_SCOPE,
    ...normalizedEvent,
    timestamp: new Date().toISOString(),
  };
  if (payload.status === 'failed') {
    console.error(payload);
    return;
  }
  console.info(payload);
}
