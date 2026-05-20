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
type OnboardingToolLogPayload = OnboardingToolEvent & {
  scope: string;
  timestamp: string;
};

function emitStructuredLog(
  level: 'info' | 'error',
  payload: OnboardingToolLogPayload,
): void {
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.info(line);
}

export function logOnboardingToolEvent(event: OnboardingToolEvent): void {
  const normalizedEvent = {
    ...event,
    ...(event.status === 'failed' && !event.error?.trim()
      ? { error: 'unknown_failure' }
      : {}),
  };
  const payload = {
    scope: ONBOARDING_TOOL_LOG_SCOPE,
    ...normalizedEvent,
    timestamp: new Date().toISOString(),
  };
  if (payload.status === 'failed') {
    emitStructuredLog('error', payload);
    return;
  }
  emitStructuredLog('info', payload);
}
