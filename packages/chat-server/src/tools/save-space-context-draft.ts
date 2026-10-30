import { z } from 'zod';
import {
  authorizeSpacePanelInteraction,
  isSpaceContextSectionKey,
  saveSpaceContextSectionDraft,
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
        'mission | vision | strategy | objectives | key_repositories | tools | how_we_decide, or a custom-… key from get_space_context',
      ),
    markdown: z.string().max(80_000),
  });

  return {
    description:
      'Save Markdown as the working draft of a Space Context section. Only call it when the member explicitly asks to save the text as the draft; when they ask what a section should say, answer in the chat instead. A draft is never official: the ratified text changes only when an Agreements proposal passes.',
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
      const result = await saveSpaceContextSectionDraft(
        {
          spaceSlug,
          sectionKey: parsed.data.section_key,
          markdown: parsed.data.markdown,
          personId: auth.person.id,
        },
        { db },
      );
      if (!result.ok) {
        return {
          ok: false,
          error:
            result.error === 'on_voting'
              ? 'The section is on voting. Drafts can be saved after the vote.'
              : 'Section not found',
        };
      }
      return {
        ok: true,
        section_key: result.section.sectionKey,
        status: result.section.status,
        version: result.section.version,
        official: false,
      };
    },
  } as ChatRouteTool;
}
