import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  ingestSpaceCallArtifacts,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createIngestSpaceCallArtifactsTool(authToken: string) {
  const inputSchema = z.object({
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

  return {
    description:
      'Persist call recording and transcript artifacts into space memory for a call session. Use when external workers provide recording URLs or transcript text.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      try {
        const safe = sanitizeSlug(parsed.data.space_slug);
        if (!safe) return { ok: false, error: 'Invalid space slug format' };
        const targetSpace = await findSpaceBySlug({ slug: safe }, { db });
        if (!targetSpace) return { ok: false, error: 'Space not found' };
        const access = await checkSpaceAccessForSpace(targetSpace, authToken);
        if (!access.hasAccess) return { ok: false, error: access.message };

        const result = await ingestSpaceCallArtifacts(
          {
            spaceSlug: safe,
            callSessionId: parsed.data.call_session_id,
            recording: parsed.data.recording
              ? {
                  mediaUri: parsed.data.recording.media_uri,
                  mimeType: parsed.data.recording.mime_type,
                  durationSeconds: parsed.data.recording.duration_seconds,
                  startedAt: parsed.data.recording.started_at,
                  endedAt: parsed.data.recording.ended_at,
                  storageKey: parsed.data.recording.storage_key,
                  source: parsed.data.recording.source,
                  metadata: parsed.data.recording.metadata,
                }
              : undefined,
            transcript: parsed.data.transcript
              ? {
                  language: parsed.data.transcript.language,
                  text: parsed.data.transcript.text,
                  summary: parsed.data.transcript.summary,
                  source: parsed.data.transcript.source,
                  segments: parsed.data.transcript.segments,
                  metadata: parsed.data.transcript.metadata,
                }
              : undefined,
          },
          { db },
        );

        if (!result.ok) return { ok: false, error: result.error };
        return {
          ok: true,
          call_session_id: result.callSessionId,
          space_id: result.spaceId,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
