import type { ChatRouteTool } from './types';

/** Tools wired into OpenAI Realtime voice discovery (onboarding setup). */
export const ONBOARDING_REALTIME_TOOL_NAMES = [
  'onboarding_guidance',
  'get_network_ecosystem_patterns',
  'propose_organisation_blueprint',
  'generate_space_visual_assets',
  'create_space_from_onboarding',
  'create_ecosystem_space',
  'get_space_by_slug',
  'create_space_setup_proposal',
  'update_space_settings',
  'mcp_navigation',
  'geocode_space_location',
] as const;

export type OnboardingRealtimeToolName =
  (typeof ONBOARDING_REALTIME_TOOL_NAMES)[number];

export function pickOnboardingRealtimeTools(
  tools: Record<string, ChatRouteTool>,
): Record<string, ChatRouteTool> {
  const picked: Record<string, ChatRouteTool> = {};
  for (const name of ONBOARDING_REALTIME_TOOL_NAMES) {
    const tool = tools[name];
    if (tool) {
      picked[name] = tool;
    }
  }
  return picked;
}
