import type { z } from 'zod';

/** Narrow contract for chat tools; `streamText` tools map is still cast (TS2589). */
export type ChatRouteTool = {
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (args: unknown) => Promise<unknown>;
};
