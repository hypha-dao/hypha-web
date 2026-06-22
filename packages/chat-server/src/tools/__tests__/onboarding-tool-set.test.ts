import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  ONBOARDING_REALTIME_TOOL_NAMES,
  pickOnboardingRealtimeTools,
} from '../onboarding-realtime-tool-names';
import type { ChatRouteTool } from '../types';

function stubTool(): ChatRouteTool {
  return {
    inputSchema: z.object({}),
    execute: async () => ({ ok: true }),
  };
}

describe('pickOnboardingRealtimeTools', () => {
  it('returns only named Realtime tools when present', () => {
    const tools: Record<string, ChatRouteTool> = {
      extra_tool: stubTool(),
    };
    for (const name of ONBOARDING_REALTIME_TOOL_NAMES) {
      tools[name] = stubTool();
    }

    const picked = pickOnboardingRealtimeTools(tools);
    expect(Object.keys(picked).sort()).toEqual(
      [...ONBOARDING_REALTIME_TOOL_NAMES].sort(),
    );
    expect(picked.extra_tool).toBeUndefined();
  });

  it('skips Realtime names that are not in the source map', () => {
    const picked = pickOnboardingRealtimeTools({
      onboarding_guidance: stubTool(),
      get_space_by_slug: stubTool(),
    });
    expect(Object.keys(picked).sort()).toEqual([
      'get_space_by_slug',
      'onboarding_guidance',
    ]);
  });
});
