import { describe, expect, it } from 'vitest';
import {
  findLatestAiPanelNavigationTarget,
  isAtNavigationTarget,
  pickBestNavigationTarget,
} from '../ai-tool-navigation';

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

  it('prefers create_space_signal_by_slug over mcp_navigation in the same turn', () => {
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
                signalSlug: 'new-signal',
                spaceSlug: 'football-ecosystem',
                title: 'New Signal',
                navigation: {
                  href: '/en/dho/football-ecosystem/coherence?signal=new-signal',
                  open_human_chat: true,
                  chat_target: 'signal_chat',
                  signal_slug: 'new-signal',
                },
              },
            },
            {
              type: 'tool-mcp_navigation',
              state: 'output-available',
              output: {
                ok: true,
                navigation: {
                  href: '/en/dho/football-ecosystem/coherence',
                },
              },
            },
          ],
        },
      ],
      ['create_space_signal_by_slug', 'mcp_navigation'],
    );

    expect(target?.toolName).toBe('create_space_signal_by_slug');
    expect(target?.href).toContain('signal=new-signal');
  });

  it('detects when the browser is already on a signal deep link', () => {
    expect(
      isAtNavigationTarget(
        '/en/dho/audio-5/coherence?signal=coh-364c0330',
        '/en/dho/audio-5/coherence',
        '?signal=coh-364c0330',
      ),
    ).toBe(true);
    expect(
      isAtNavigationTarget(
        '/en/dho/audio-5/coherence?signal=coh-new',
        '/en/dho/audio-5/coherence',
        '?signal=coh-old',
      ),
    ).toBe(false);
    expect(
      isAtNavigationTarget(
        '/en/dho/audio-5/coherence?signal=coh-new',
        '/en/dho/audio-5/agreements',
        '',
      ),
    ).toBe(false);
  });

  it('pickBestNavigationTarget honors tool priority', () => {
    const best = pickBestNavigationTarget([
      {
        href: '/en/dho/x/coherence',
        openInNewTab: false,
        openHumanChat: false,
        toolName: 'mcp_navigation',
        key: 'a',
      },
      {
        href: '/en/dho/x/coherence?signal=y',
        openInNewTab: false,
        openHumanChat: true,
        toolName: 'create_space_signal_by_slug',
        key: 'b',
      },
    ]);
    expect(best?.toolName).toBe('create_space_signal_by_slug');
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
