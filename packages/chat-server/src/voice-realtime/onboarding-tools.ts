import {
  createOnboardingToolSet,
  pickOnboardingRealtimeTools,
  type OnboardingToolConfig,
} from '../tools/onboarding-tool-set';
import { ONBOARDING_REALTIME_TOOL_NAMES } from '../tools/onboarding-realtime-tool-names';
import type { ChatRouteTool } from '../tools/types';

export { ONBOARDING_REALTIME_TOOL_NAMES };
export type { OnboardingToolConfig } from '../tools/onboarding-tool-set';

/** Realtime voice discovery tool subset (same executors as chat onboarding). */
export function createOnboardingRealtimeTools(
  config: OnboardingToolConfig,
): Record<string, ChatRouteTool> {
  return pickOnboardingRealtimeTools(createOnboardingToolSet(config));
}
