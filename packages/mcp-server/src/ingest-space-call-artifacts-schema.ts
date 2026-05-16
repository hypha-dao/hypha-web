import { z } from 'zod';

export const ingestSpaceCallArtifactsInputSchema = z.object({
  space_slug: z.string().trim().min(1),
  call_session_id: z.string().trim().min(1),
  recording: z
    .object({
      media_uri: z.string().trim().min(1),
      mime_type: z.string().trim().optional(),
      duration_seconds: z.number().int().nonnegative().optional(),
      started_at: z.string().trim().optional(),
      ended_at: z.string().trim().optional(),
      storage_key: z.string().trim().optional(),
      source: z.string().trim().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  transcript: z
    .object({
      language: z.string().trim().optional(),
      text: z.string().trim().min(1),
      summary: z.string().trim().optional(),
      source: z.string().trim().optional(),
      segments: z.array(z.record(z.string(), z.unknown())).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export const ingestSpaceCallArtifactsOutputSchema = z.object({
  ok: z.boolean(),
  spaceId: z.number().optional(),
  callSessionId: z.string().optional(),
  error: z.string().optional(),
});
