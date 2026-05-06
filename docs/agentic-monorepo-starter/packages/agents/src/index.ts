import { tool } from "ai";
import { z } from "zod";

export const tools = {
  getTime: tool({
    description: "Get current time in a timezone.",
    inputSchema: z.object({
      timezone: z.string().default("UTC")
    }),
    execute: async ({ timezone }) => {
      const now = new Date().toLocaleString("en-US", { timeZone: timezone });
      return { timezone, now };
    }
  })
};
