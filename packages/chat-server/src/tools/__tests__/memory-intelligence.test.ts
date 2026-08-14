import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from '../../system-prompt';
import {
  HYPHA_AI_SOURCE_APP_FALLBACK,
  resolveHyphaAiSourceApp,
} from '../memory-write-identity';
import { inferSpaceScreenFromIntent } from '../space-screen-intent';

describe('resolveHyphaAiSourceApp', () => {
  it('stamps hypha-ai when no env override is set', () => {
    const result = resolveHyphaAiSourceApp();
    expect(result).toEqual({
      ok: true,
      source_app: HYPHA_AI_SOURCE_APP_FALLBACK,
    });
  });

  it('rejects a claimed source_app that does not match hypha-ai', () => {
    const result = resolveHyphaAiSourceApp('hypha-mcp');
    expect(result.ok).toBe(false);
  });
});

describe('buildSystemPrompt intelligence routing', () => {
  it('teaches the space advisor not to create a second Coherence signal for artifacts', () => {
    const prompt = buildSystemPrompt('belica-5-0');
    expect(prompt).toContain('memory_create');
    expect(prompt).toContain(
      'Never call create_space_signal_by_slug for that request',
    );
    expect(prompt).toContain('Space INTELLIGENCE');
    expect(prompt).toContain('linked_signals');
  });
});

describe('inferSpaceScreenFromIntent', () => {
  it('routes artifact-from-signal hints to Memory, not Coherence', () => {
    expect(
      inferSpaceScreenFromIntent('create an artifact based on this signal'),
    ).toBe('memory');
    expect(inferSpaceScreenFromIntent('open space intelligence')).toBe(
      'memory',
    );
  });

  it('still routes plain signal-board hints to Coherence', () => {
    expect(inferSpaceScreenFromIntent('show me the signal board')).toBe(
      'signals',
    );
  });
});
