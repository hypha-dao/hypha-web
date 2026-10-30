import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildProposalMarkdown,
  buildSpaceContextAgentPrompt,
  detectSpaceContextAgentIntent,
  isProposableSection,
  isSpaceContextSectionKey,
  normalizeSectionTitle,
  officialSectionMarkdown,
  sectionKeysFromProposalMarkdown,
  sectionMatchesFilter,
  specialistForSectionKey,
} from '../index';
import { mapSectionRow } from '../server/map-row';
import { ratifySpaceContextSectionsByDocumentId } from '../server/mutations';

const baseRow = {
  id: 1,
  spaceId: 1,
  sectionKey: 'mission',
  title: null,
  markdown: 'We restore land.',
  status: 'ratified',
  version: 2,
  proposalDocumentId: null,
  ratifiedDocumentId: 9,
  ratifiedAt: new Date(),
  ratifiedMarkdown: 'We restore land.',
  pendingChange: null,
  removedAt: null,
  chatRoomId: null,
  updatedByPersonId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Parameters<typeof mapSectionRow>[0];

describe('agent intent', () => {
  it('answers in the chat when asked what a section should say', () => {
    expect(
      detectSpaceContextAgentIntent(
        '@hypha-bot:matrix.org What would the agent say? The mission is https://example.org/save-the-forest',
      ),
    ).toBe('answer');
    expect(
      detectSpaceContextAgentIntent(
        'What should our mission be, based on this?',
      ),
    ).toBe('answer');
    expect(
      detectSpaceContextAgentIntent('What would you propose the mission be?'),
    ).toBe('answer');
    expect(detectSpaceContextAgentIntent('Draft the vision for us')).toBe(
      'answer',
    );
    expect(
      detectSpaceContextAgentIntent(
        'Link: https://x.org/proposal/42 thoughts?',
      ),
    ).toBe('answer');
  });

  it('saves only when a member asks to save it as the draft', () => {
    expect(
      detectSpaceContextAgentIntent(
        "That is a good one. Yes, let's save it as a draft",
      ),
    ).toBe('save_draft');
    expect(detectSpaceContextAgentIntent('Put this into the draft')).toBe(
      'save_draft',
    );
    expect(detectSpaceContextAgentIntent('Bitte als Entwurf speichern')).toBe(
      'save_draft',
    );
    expect(detectSpaceContextAgentIntent('Pode salvar como rascunho')).toBe(
      'save_draft',
    );
  });

  it('recognises a request to make a proposal', () => {
    expect(
      detectSpaceContextAgentIntent("Great, let's make a proposal from it"),
    ).toBe('propose');
    expect(detectSpaceContextAgentIntent('Submit it for ratification')).toBe(
      'propose',
    );
    expect(detectSpaceContextAgentIntent('Vamos criar uma proposta')).toBe(
      'propose',
    );
  });

  it('gives no save instruction to a chat-only turn', () => {
    const prompt = buildSpaceContextAgentPrompt({
      sectionKey: 'mission',
      spaceTitle: 'Hypha',
      spaceSlug: 'hypha',
      draftMarkdown: '',
      ratifiedMarkdown: 'Official mission.',
      status: 'ratified',
      specialistMemory: '',
      intent: 'answer',
    });
    expect(prompt).toContain('Answer in the chat only');
    expect(prompt).not.toContain('Call save_section_draft');
    expect(prompt).toContain('Official mission.');
  });

  it('ends a proposal turn with the propose link', () => {
    const prompt = buildSpaceContextAgentPrompt({
      sectionKey: 'mission',
      spaceTitle: 'Hypha',
      spaceSlug: 'hypha',
      draftMarkdown: 'Draft.',
      ratifiedMarkdown: null,
      status: 'draft',
      specialistMemory: '',
      intent: 'propose',
      proposeUrl: 'https://app.test/dho/hypha/context/create?sections=mission',
    });
    expect(prompt).toContain(
      'https://app.test/dho/hypha/context/create?sections=mission',
    );
  });
});

describe('official text vs working draft', () => {
  it('keeps the ratified text official while a draft amendment waits', () => {
    const section = mapSectionRow({
      ...baseRow,
      markdown: 'A new idea from chat.',
    });
    expect(section?.status).toBe('ratified');
    expect(section?.ratifiedMarkdown).toBe('We restore land.');
    expect(section?.markdown).toBe('A new idea from chat.');
    expect(section?.hasDraftChanges).toBe(true);
    expect(section && sectionMatchesFilter(section, 'drafts')).toBe(true);
    expect(section && isProposableSection(section)).toBe(true);
  });

  it('has no official text before the first ratification', () => {
    const section = mapSectionRow({
      ...baseRow,
      status: 'draft',
      ratifiedDocumentId: null,
      ratifiedMarkdown: null,
    });
    expect(section?.ratifiedMarkdown).toBeNull();
    expect(section?.hasDraftChanges).toBe(false);
    expect(section && officialSectionMarkdown(section)).toBeNull();
  });

  it('never treats a restored section as official before its vote', () => {
    const section = mapSectionRow({
      ...baseRow,
      status: 'draft',
      pendingChange: 'add',
      removedAt: new Date(),
    });
    expect(section?.ratifiedMarkdown).toBe('We restore land.');
    expect(section && officialSectionMarkdown(section)).toBeNull();
  });

  it('does not offer an unchanged ratified section for ratification', () => {
    const section = mapSectionRow(baseRow);
    expect(section?.hasDraftChanges).toBe(false);
    expect(section && isProposableSection(section)).toBe(false);
  });
});

describe('added and removed sections', () => {
  it('accepts member-added keys and keeps retired keys out', () => {
    expect(isSpaceContextSectionKey('custom-a1b2c3d4e5f6')).toBe(true);
    expect(isSpaceContextSectionKey('custom-')).toBe(false);
    expect(isSpaceContextSectionKey('custom-../x')).toBe(false);
    expect(isSpaceContextSectionKey('projects')).toBe(false);
    expect(specialistForSectionKey('custom-a1b2c3d4e5f6').agentName).toBe(
      'Scribe Context',
    );
    expect(specialistForSectionKey('mission').agentName).toBe('Aura Mission');
  });

  it('maps an added section with its own title, outside the official set', () => {
    const section = mapSectionRow({
      ...baseRow,
      sectionKey: 'custom-a1b2c3d4e5f6',
      title: 'Onboarding',
      status: 'draft',
      ratifiedDocumentId: null,
      ratifiedMarkdown: null,
      pendingChange: 'add',
    });
    expect(section?.title).toBe('Onboarding');
    expect(section?.isCustom).toBe(true);
    expect(section?.pendingChange).toBe('add');
    expect(section && isProposableSection(section)).toBe(true);
  });

  it('lets a removal suggestion go to a proposal', () => {
    const section = mapSectionRow({ ...baseRow, pendingChange: 'remove' });
    expect(section && isProposableSection(section)).toBe(true);
    expect(section && sectionMatchesFilter(section, 'drafts')).toBe(true);
  });

  it('writes add and remove into the proposal body', () => {
    const markdown = buildProposalMarkdown([
      {
        key: 'custom-a1b2c3d4e5f6',
        title: 'Onboarding',
        markdown: 'How newcomers start.',
        change: 'add',
      },
      { key: 'tools', title: 'Tools we use', markdown: '', change: 'remove' },
    ]);
    expect(markdown).toContain('## Add section: Onboarding');
    expect(markdown).toContain('How newcomers start.');
    expect(markdown).toContain('## Remove section: Tools we use');
    expect(sectionKeysFromProposalMarkdown(markdown)).toEqual(['tools']);
  });

  it('marks a section removed when its removal proposal passes', async () => {
    const selects: unknown[][] = [
      [{ id: 5 }],
      [{ id: 42 }],
      [{ id: 5, pendingChange: 'remove' }],
    ];
    const updates: Record<string, unknown>[] = [];
    const query = (rows: unknown[]) => {
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => chain,
        then: (
          resolve: (value: unknown[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) => Promise.resolve(rows).then(resolve, reject),
      };
      return chain;
    };
    const db = {
      select: () => query(selects.shift() ?? []),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          updates.push(values);
          return { where: () => Promise.resolve() };
        },
      }),
    } as unknown as Parameters<
      typeof ratifySpaceContextSectionsByDocumentId
    >[1]['db'];

    const count = await ratifySpaceContextSectionsByDocumentId(
      { documentId: 42 },
      { db },
    );

    expect(count).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.removedAt).toBeInstanceOf(Date);
    expect(updates[0]?.pendingChange).toBeNull();
  });

  it('normalises a suggested title to one plain line', () => {
    expect(normalizeSectionTitle('  ## Onboarding\n guide ')).toBe(
      'Onboarding guide',
    );
    expect(normalizeSectionTitle('   ')).toBe('');
    expect(normalizeSectionTitle('x'.repeat(200))).toHaveLength(80);
  });
});
