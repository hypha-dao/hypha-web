import { z } from 'zod';

/** Shared slug validation across MCP space-slug tools. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(
    /^[a-z0-9'-]+$/,
    'Slug must contain only lowercase letters, numbers, hyphens, and apostrophes',
  );
