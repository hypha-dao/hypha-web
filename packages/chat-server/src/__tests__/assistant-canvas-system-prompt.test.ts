import { describe, expect, it } from 'vitest';

import {
  ASSISTANT_CANVAS_DOMAIN_GUIDANCE,
  ASSISTANT_CANVAS_INTERACTION_GUIDANCE,
  ASSISTANT_CANVAS_PERSONA,
  buildAssistantCanvasSystemPrompt,
} from '../system-prompt';
import { conversationContextSchema } from '../request-schema';

describe('buildAssistantCanvasSystemPrompt', () => {
  it('assembles the four slots in order', () => {
    const prompt = buildAssistantCanvasSystemPrompt({
      spaceSlug: 'hypha',
      widgetCatalogue: '- signals: shows this space signals. params: spaceSlug',
      orgContextSnapshot: 'ACTIVE SPACE CONTEXT: hypha',
    });

    const personaAt = prompt.indexOf(ASSISTANT_CANVAS_PERSONA);
    const catalogueAt = prompt.indexOf('- signals: shows this space signals');
    const domainAt = prompt.indexOf(ASSISTANT_CANVAS_DOMAIN_GUIDANCE);
    const snapshotAt = prompt.indexOf('ACTIVE SPACE CONTEXT: hypha');
    const guidanceAt = prompt.indexOf(ASSISTANT_CANVAS_INTERACTION_GUIDANCE);

    expect(personaAt).toBe(0);
    expect(catalogueAt).toBeGreaterThan(personaAt);
    expect(domainAt).toBeGreaterThan(catalogueAt);
    expect(snapshotAt).toBeGreaterThan(domainAt);
    expect(guidanceAt).toBeGreaterThan(snapshotAt);
    expect(prompt).toContain('Active space for this session: "hypha"');
  });

  it('falls back when no catalogue or snapshot is provided', () => {
    const prompt = buildAssistantCanvasSystemPrompt({});
    expect(prompt).toContain('no widgets are registered for this session');
    expect(prompt).toContain(ASSISTANT_CANVAS_DOMAIN_GUIDANCE);
    expect(prompt).not.toContain('Active space for this session');
  });

  it('sanitises the space slug', () => {
    const prompt = buildAssistantCanvasSystemPrompt({
      spaceSlug: '../../etc/passwd',
    });
    expect(prompt).not.toContain('../../etc/passwd');
  });
});

describe('conversationContextSchema (canvas mode)', () => {
  it('accepts a conversational_canvas context with widget fields', () => {
    const parsed = conversationContextSchema.parse({
      mode: 'conversational_canvas',
      widgetCatalogue: '- signals: …',
      widgetIds: ['signals', 'treasury'],
      spaceSlug: 'hypha',
    });
    expect(parsed.mode).toBe('conversational_canvas');
    expect(parsed.widgetIds).toEqual(['signals', 'treasury']);
  });

  it('still accepts the onboarding_setup context', () => {
    const parsed = conversationContextSchema.parse({
      mode: 'onboarding_setup',
    });
    expect(parsed.mode).toBe('onboarding_setup');
  });

  it('rejects an unknown mode', () => {
    expect(() =>
      conversationContextSchema.parse({ mode: 'something_else' }),
    ).toThrow();
  });
});
