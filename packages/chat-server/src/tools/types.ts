import type { z } from 'zod';

/**
 * Chat tool contract for `streamText`. Generic over the Zod input schema so
 * `execute` can use `z.infer<TSchema>` after validating with the same schema.
 */
export type ChatRouteTool<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  description: string;
  inputSchema: TSchema;
  execute: (args: z.infer<TSchema>) => Promise<unknown>;
};
