import { describe, expect, it } from 'vitest';

import {
  extractEcosystemBlueprintFromMessages,
  mergeEcosystemBlueprintWithCreatedSpaces,
} from '../onboarding-ecosystem-blueprint';

describe('onboarding-ecosystem-blueprint', () => {
  it('extracts blueprint nodes from propose_organisation_blueprint tool output', () => {
    const blueprint = extractEcosystemBlueprintFromMessages([
      {
        parts: [
          {
            type: 'tool-propose_organisation_blueprint',
            state: 'output-available',
            output: {
              ok: true,
              blueprint: {
                nodes: [
                  {
                    key: 'acme-community',
                    role: 'community_hub',
                    title: 'Community Hub',
                    status: 'planned',
                  },
                ],
              },
            },
          },
        ],
      },
    ]);

    expect(blueprint).toEqual([
      {
        key: 'acme-community',
        role: 'community_hub',
        title: 'Community Hub',
        status: 'planned',
      },
    ]);
  });

  it('marks blueprint nodes created when child spaces exist', () => {
    const merged = mergeEcosystemBlueprintWithCreatedSpaces(
      [
        {
          key: 'acme-community',
          role: 'community_hub',
          title: 'Community Hub',
          status: 'planned',
        },
      ],
      [
        {
          parts: [
            {
              type: 'tool-create_ecosystem_space',
              state: 'output-available',
              output: {
                ok: true,
                space: {
                  slug: 'acme-community',
                  role_in_ecosystem: 'community_hub',
                },
              },
            },
          ],
        },
      ],
    );

    expect(merged[0]?.status).toBe('created');
  });
});
