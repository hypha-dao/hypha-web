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

  it('M7: unlocked scope invites set_scope and lists known spaces', () => {
    const prompt = buildAssistantCanvasSystemPrompt({
      spaceSlug: 'hypha',
      scopeLocked: false,
      knownSpaces: [
        { slug: 'hypha', title: 'Hypha' },
        { slug: 'ateneo-de-manila', title: 'Ateneo de Manila' },
      ],
    });
    expect(prompt).toContain('`set_scope`');
    expect(prompt).toContain('"Ateneo de Manila" (ateneo-de-manila)');
    expect(prompt).not.toContain('LOCKED');
  });

  it('M7: locked scope forbids set_scope and stays strict', () => {
    const prompt = buildAssistantCanvasSystemPrompt({
      spaceSlug: 'hypha',
      scopeLocked: true,
      knownSpaces: [{ slug: 'hypha' }],
    });
    expect(prompt).toContain('LOCKED');
    expect(prompt).toContain('space selector');
    expect(prompt).not.toContain('call `set_scope`');
  });

  it('M7: no active space but known spaces — still points at set_scope', () => {
    const prompt = buildAssistantCanvasSystemPrompt({
      knownSpaces: [{ slug: 'hypha', title: 'Hypha' }],
    });
    expect(prompt).toContain('No space is scoped yet');
    expect(prompt).toContain('`set_scope`');
  });

  it('M7: hard rules sit right after the persona, before the catalogue', () => {
    const prompt = buildAssistantCanvasSystemPrompt({
      spaceSlug: 'hypha',
      widgetCatalogue: '- signals: shows this space signals. params: spaceSlug',
    });
    const personaAt = prompt.indexOf(ASSISTANT_CANVAS_PERSONA);
    const rulesAt = prompt.indexOf('NON-NEGOTIABLE — every substantive turn');
    const catalogueAt = prompt.indexOf('- signals: shows this space signals');
    expect(rulesAt).toBeGreaterThan(personaAt);
    expect(catalogueAt).toBeGreaterThan(rulesAt);
    // The read tools must not be presentable as a substitute for set_canvas.
    expect(prompt).toContain('grounding only');
    expect(prompt).toContain('set_next_actions');
  });

  it('M7: unlocked active space warns that it overrides earlier turns', () => {
    const prompt = buildAssistantCanvasSystemPrompt({
      spaceSlug: 'hypha',
      scopeLocked: false,
    });
    expect(prompt).toContain('OVERRIDES any different space named earlier');
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

  it('M7: accepts knownSpaces + scopeLocked on a canvas context', () => {
    const parsed = conversationContextSchema.parse({
      mode: 'conversational_canvas',
      knownSpaces: [
        { slug: 'hypha', title: 'Hypha' },
        { slug: 'ateneo-de-manila' },
      ],
      scopeLocked: true,
    });
    expect(parsed.scopeLocked).toBe(true);
    expect(parsed.knownSpaces).toHaveLength(2);
  });

  it('rejects an unknown mode', () => {
    expect(() =>
      conversationContextSchema.parse({ mode: 'something_else' }),
    ).toThrow();
  });
});
