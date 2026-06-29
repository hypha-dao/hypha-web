import { z } from 'zod';

export const createHumanChatMessageInputSchema = z
  .object({
    space_slug: z.string().trim().min(1),
    message: z.string().trim().min(1).max(4000),
    target: z
      .enum(['space_chat', 'signal_chat'])
      .optional()
      .default('space_chat'),
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

const navigationSchema = z.object({
  kind: z.literal('internal'),
  href: z.string(),
  open_human_chat: z.literal(true),
  chat_target: z.enum(['space_chat', 'signal_chat']),
  room_id: z.string(),
  message_event_id: z.string(),
  signal_slug: z.string().optional(),
  signal_title: z.string().optional(),
  label: z.string(),
});

export const createHumanChatMessageOutputSchema = z.union([
  z.object({
    ok: z.literal(true),
    room_id: z.string(),
    message_event_id: z.string(),
    navigation: navigationSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);
