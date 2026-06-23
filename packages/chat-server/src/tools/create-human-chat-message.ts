import { z } from 'zod';
import { sendHumanChatMessageForSpace } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

const targetSchema = z.enum(['space_chat', 'signal_chat']);

export function createHumanChatMessageTool(
  authToken: string,
  requestUrlForSessionMatrix?: string,
) {
  const inputSchema = z
    .object({
      space_slug: z.string().trim().min(1),
      message: z.string().trim().min(1).max(4000),
      target: targetSchema.default('space_chat'),
      signal_slug: z.string().trim().min(1).optional(),
      room_id: z.string().trim().min(1).optional(),
      lang: z
        .string()
        .trim()
        .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
        .optional(),
    })
    .superRefine((value, ctx) => {
      if (
        value.target === 'signal_chat' &&
        !value.signal_slug &&
        !value.room_id
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['signal_slug'],
          message:
            'signal_slug or room_id is required when target is signal_chat.',
        });
      }
    });

  return {
    description:
      'Write: post a message in Human Chat on behalf of the signed-in member. Use target space_chat for the space group room, or signal_chat with signal_slug for a signal thread. Always returns navigation metadata so the app opens the right Human Chat panel on the new message.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return { ok: false, error: 'Invalid space slug format.' };

      return sendHumanChatMessageForSpace(
        {
          spaceSlug: safe,
          message: parsed.data.message,
          target: parsed.data.target,
          signalSlug: parsed.data.signal_slug,
          roomId: parsed.data.room_id,
          lang: parsed.data.lang,
          authToken,
          requestUrlForSessionMatrix,
        },
        { db },
      );
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
