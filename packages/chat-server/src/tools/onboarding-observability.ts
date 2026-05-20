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
type SanitizedOnboardingToolLogPayload = {
  scope: string;
  timestamp: string;
  tool: string;
  status: OnboardingToolEventStatus;
  spaceSlug?: string;
  dedupeKey?: string;
  hasActorSub: boolean;
  hasDetails: boolean;
  hasError: boolean;
};

function emitStructuredLog(
  level: 'info' | 'error',
  payload: SanitizedOnboardingToolLogPayload,
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
  const sanitizedPayload: SanitizedOnboardingToolLogPayload = {
    scope: payload.scope,
    timestamp: payload.timestamp,
    tool: payload.tool,
    status: payload.status,
    spaceSlug: payload.spaceSlug,
    dedupeKey: payload.dedupeKey,
    hasActorSub: Boolean(payload.actorSub?.trim()),
    hasDetails: Boolean(payload.details),
    hasError: Boolean(payload.error?.trim()),
  };
  if (payload.status === 'failed') {
    emitStructuredLog('error', sanitizedPayload);
    return;
  }
  emitStructuredLog('info', sanitizedPayload);
}
