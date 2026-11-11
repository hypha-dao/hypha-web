import { z } from 'zod';
import {
  authorizeSpacePanelInteraction,
  isSpaceContextSectionKey,
  saveSpaceContextAgentMemory,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createSaveSpaceContextMemoryTool(
  authToken: string,
): ChatRouteTool {
  const inputSchema = z.object({
    space_slug: z.string().trim().min(1),
    section_key: z.string().trim().min(1),
    memory_markdown: z.string().max(20_000),
  });

  return {
    description:
      'Save private specialist memory for this Space Context section in this space. Keep short facts you will need on later turns.',
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
      const ok = await saveSpaceContextAgentMemory(
        {
          spaceSlug,
          sectionKey: parsed.data.section_key,
          memoryMarkdown: parsed.data.memory_markdown,
        },
        { db },
      );
      return { ok, section_key: parsed.data.section_key };
    },
  } as ChatRouteTool;
}
