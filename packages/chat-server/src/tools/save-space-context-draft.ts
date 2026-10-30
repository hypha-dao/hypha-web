import { z } from 'zod';
import {
  authorizeSpacePanelInteraction,
  isSpaceContextSectionKey,
  patchSpaceContextSection,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createSaveSpaceContextDraftTool(
  authToken: string,
): ChatRouteTool {
  const inputSchema = z.object({
    space_slug: z.string().trim().min(1),
    section_key: z
      .string()
      .trim()
      .min(1)
      .describe(
        'mission | vision | strategy | objectives | key_repositories | tools | how_we_decide',
      ),
    markdown: z.string().max(80_000),
  });

  return {
    description:
      'Write Markdown onto a Space Context section card. Members still ratify through Agreements. Use after the member agrees the draft is ready to keep.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const spaceSlug = sanitizeSlug(parsed.data.space_slug);
      if (!spaceSlug) return { ok: false, error: 'Invalid space slug format' };
      if (!isSpaceContextSectionKey(parsed.data.section_key)) {
        return { ok: false, error: 'Unknown section key' };
      }
      const auth = await authorizeSpacePanelInteraction({
        spaceSlug,
        authToken,
      });
      if (!auth.authorized) {
        return { ok: false, error: auth.message };
      }
      const section = await patchSpaceContextSection(
        {
          spaceSlug,
          sectionKey: parsed.data.section_key,
          markdown: parsed.data.markdown,
          personId: auth.person.id,
        },
        { db },
      );
      if (!section) return { ok: false, error: 'Section not found' };
      return {
        ok: true,
        section_key: section.sectionKey,
        status: section.status,
        version: section.version,
      };
    },
  } as ChatRouteTool;
}
