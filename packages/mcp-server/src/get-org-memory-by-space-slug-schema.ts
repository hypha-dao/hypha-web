import { z } from 'zod';
import {
  getPeopleBySpaceSlugInputSchema,
  getPeopleBySpaceSlugOutputSchema,
} from './get-people-by-space-slug-schema.js';

/** Same inputs as `get_people_by_space_slug` (roster pagination + optional search). */
export const getOrgMemoryBySpaceSlugInputSchema =
  getPeopleBySpaceSlugInputSchema;

export type GetOrgMemoryBySpaceSlugInput = z.infer<
  typeof getOrgMemoryBySpaceSlugInputSchema
>;

/**
 * v1: identical roster payload to `get_people_by_space_slug` plus `org_memory_assets`
 * (must be empty until the org memory catalogue ships — see docs/requirements).
 */
export const getOrgMemoryBySpaceSlugOutputSchema =
  getPeopleBySpaceSlugOutputSchema.extend({
    org_memory_assets: z.array(z.never()),
  });

export type GetOrgMemoryBySpaceSlugOutput = z.infer<
  typeof getOrgMemoryBySpaceSlugOutputSchema
>;
