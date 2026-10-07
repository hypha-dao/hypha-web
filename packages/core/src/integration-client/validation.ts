import { z } from 'zod';

import { INTEGRATION_CLIENT_SCOPES } from './types';

/** Origins must be bare `https://host[:port]` (http only for localhost). */
const originSchema = z
  .string()
  .trim()
  .max(255)
  .refine((value) => {
    try {
      const url = new URL(value);
      const secure =
        url.protocol === 'https:' ||
        (url.protocol === 'http:' && url.hostname === 'localhost');
      return secure && url.origin === value;
    } catch {
      return false;
    }
  }, 'Must be an origin such as https://app.example.com (no path or trailing slash)');

export const schemaRequestIntegrationClient = z.object({
  name: z.string().trim().min(1).max(120),
  contactEmail: z.string().trim().email().max(255),
  description: z.string().trim().max(1000).optional(),
  scopes: z.array(z.enum(INTEGRATION_CLIENT_SCOPES)).min(1).max(10),
  allowedOrigins: z.array(originSchema).max(10).default([]),
});

export type RequestIntegrationClientInput = z.input<
  typeof schemaRequestIntegrationClient
>;

/** Ops may narrow or edit the requested scopes when approving. */
export const schemaApproveIntegrationClient = z.object({
  scopes: z.array(z.enum(INTEGRATION_CLIENT_SCOPES)).min(1).max(10).optional(),
});

export function slugifyClientName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'client'
  );
}
