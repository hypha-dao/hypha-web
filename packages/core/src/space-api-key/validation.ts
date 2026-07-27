import { z } from 'zod';

import { SPACE_API_KEY_SCOPES } from './types';

export const spaceApiKeySourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'Source must be lowercase letters, numbers and hyphens',
  );

export const schemaCreateSpaceApiKey = z.object({
  name: z.string().trim().min(1).max(120),
  source: spaceApiKeySourceSchema,
  scopes: z.array(z.enum(SPACE_API_KEY_SCOPES)).min(1).max(10),
});
