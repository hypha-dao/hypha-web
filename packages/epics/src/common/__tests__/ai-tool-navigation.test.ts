import { describe, expect, it } from 'vitest';
import { findLatestAiPanelNavigationTarget } from '../ai-tool-navigation';

describe('findLatestAiPanelNavigationTarget', () => {
  it('routes to the new signal after create_space_signal_by_slug', () => {
    const target = findLatestAiPanelNavigationTarget(
      [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-create_space_signal_by_slug',
              state: 'output-available',
              output: {
                ok: true,
                signalSlug: 'increase-member-engagement',
                spaceSlug: 'football-ecosystem',
                title: 'Increase Member Engagement Through Local Activities',
                navigation: {
                  kind: 'internal',
                  href: '/en/dho/football-ecosystem/coherence?signal=increase-member-engagement',
                  open_human_chat: true,
                  chat_target: 'signal_chat',
                  signal_slug: 'increase-member-engagement',
                  signal_title:
                    'Increase Member Engagement Through Local Activities',
                  label: 'Increase Member Engagement Through Local Activities',
                },
              },
            },
          ],
        },
      ],
      ['create_space_signal_by_slug'],
    );

    expect(target?.href).toBe(
      '/en/dho/football-ecosystem/coherence?signal=increase-member-engagement',
    );
    expect(target?.coherenceChat?.slug).toBe('increase-member-engagement');
    expect(target?.toolName).toBe('create_space_signal_by_slug');
  });

  it('routes to memory after summarize_space_discussion_by_slug', () => {
    const target = findLatestAiPanelNavigationTarget(
      [
        {
          id: 'assistant-2',
          role: 'assistant',
          parts: [
            {
              type: 'tool-summarize_space_discussion_by_slug',
              state: 'output-available',
              output: {
                ok: true,
                space_slug: 'football-ecosystem',
                navigation: {
                  kind: 'internal',
                  href: '/en/dho/football-ecosystem/memory',
                  label: 'Open Space Memory',
                  screen: 'memory',
                  space_slug: 'football-ecosystem',
                },
              },
            },
          ],
        },
      ],
      ['summarize_space_discussion_by_slug'],
    );

    expect(target?.href).toBe('/en/dho/football-ecosystem/memory');
  });

  it('routes to new space overview after create_ecosystem_space', () => {
    const target = findLatestAiPanelNavigationTarget(
      [
        {
          id: 'assistant-3',
          role: 'assistant',
          parts: [
            {
              type: 'tool-create_ecosystem_space',
              state: 'output-available',
              output: {
                ok: true,
                space: {
                  slug: 'youth-program',
                  title: 'Youth Program',
                },
                navigation: {
                  kind: 'internal',
                  href: '/en/dho/youth-program/overview',
                  label: 'Open Youth Program',
                  screen: 'overview',
                  space_slug: 'youth-program',
                },
              },
            },
          ],
        },
      ],
      ['create_ecosystem_space'],
    );

    expect(target?.href).toBe('/en/dho/youth-program/overview');
  });
});
