import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from '../../system-prompt';
import {
  HYPHA_AI_SOURCE_APP_FALLBACK,
  resolveHyphaAiSourceApp,
} from '../memory-write-identity';
import {
  buildMemoryCreateFields,
  normalizeIntelligenceArtifactType,
  normalizeLinkedSignalSlugs,
  slugifyIntelligenceId,
  stripAccidentalYamlFence,
} from '../memory-artifact-fields';
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

describe('memory artifact field assembly', () => {
  it('slugifies titles the model used to dump into YAML', () => {
    expect(slugifyIntelligenceId('Hypha x Belica 5.0 Insight')).toBe(
      'hypha-x-belica-5-0-insight',
    );
  });

  it('coerces Coherence signal type to insight', () => {
    expect(normalizeIntelligenceArtifactType('signal')).toBe('insight');
    expect(normalizeIntelligenceArtifactType('assessment')).toBe('assessment');
  });

  it('accepts a single linked signal slug', () => {
    expect(normalizeLinkedSignalSlugs('coh-138')).toEqual(['coh-138']);
  });

  it('strips accidental YAML fences from body', () => {
    const body = stripAccidentalYamlFence(`---
id: hypha-x-belica-5-0
type: insight
---

Community dynamics matter as membership grows.
`);
    expect(body).toBe('Community dynamics matter as membership grows.');
  });

  it('assembles create fields without requiring YAML from the model', () => {
    const fields = buildMemoryCreateFields({
      title: 'Hypha x Belica 5.0 Insight',
      type: 'insight',
      body: 'Membership growth needs clearer community dynamics.',
      linkedSignals: 'coh-138',
    });
    expect(fields).toEqual({
      id: 'hypha-x-belica-5-0-insight',
      type: 'insight',
      title: 'Hypha x Belica 5.0 Insight',
      body: 'Membership growth needs clearer community dynamics.',
      linked_signals: ['coh-138'],
      tags: undefined,
    });
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
    expect(prompt).toContain('Do not write YAML frontmatter');
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
