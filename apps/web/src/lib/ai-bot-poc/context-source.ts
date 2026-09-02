// server-only: reached only from API route handlers (#2485 POC).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { jsonSchema, tool } from 'ai';

/**
 * #2485 POC knowledge source: the local `hypha-context` checkout.
 *
 *  - `PINNED_RELATIVE_PATHS` are read and concatenated into the system prompt on every call.
 *  - `createReadFileTool()` lets the model pull additional files, constrained to the repo root
 *    (no `..`, no absolute escape, no symlink escape), size-capped.
 *
 * No indexing / chunking / embeddings — deliberately (spec §Non-goals).
 *
 * Tool schemas use `jsonSchema()` rather than zod: apps/web resolves an older hoisted zod than
 * `ai@6`'s `tool()` inference wants, which trips TS2589 (excessively deep). Plain JSON Schema
 * sidesteps it with zero new deps — fine for a throwaway POC.
 */

/**
 * Curated grounding files. Adjusted from the spec's original guess (`research/*`) — that dir
 * does not exist in the current `hypha-context` layout. Missing entries are skipped with a warn.
 */
export const PINNED_RELATIVE_PATHS = [
  'AGENTS.md',
  'solution/overview.md',
  'solution/tech/overview.md',
  'solution/tech/tech-map.md',
] as const;

const MAX_FILE_BYTES = 64 * 1024;

function resolveWithinRepo(repoRoot: string, requested: string): string | null {
  const root = path.resolve(repoRoot);
  const candidate = path.resolve(root, requested);
  const rel = path.relative(root, candidate);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return candidate;
}

async function readCappedTextFile(absPath: string): Promise<string> {
  // Reject symlinks explicitly — `path.resolve` alone would not catch a symlinked escape.
  const stat = await fs.lstat(absPath);
  if (stat.isSymbolicLink()) throw new Error('symlink not allowed');
  if (!stat.isFile()) throw new Error('not a regular file');
  const raw = await fs.readFile(absPath, 'utf8');
  return raw.length > MAX_FILE_BYTES
    ? `${raw.slice(0, MAX_FILE_BYTES)}\n…[truncated at ${MAX_FILE_BYTES} bytes]`
    : raw;
}

/** Reads the pinned files, returns a single prompt-ready block with path headers. */
export async function buildPinnedContextBlock(
  repoRoot: string,
): Promise<string> {
  const sections: string[] = [];
  for (const rel of PINNED_RELATIVE_PATHS) {
    const abs = resolveWithinRepo(repoRoot, rel);
    if (!abs) continue;
    try {
      const content = await readCappedTextFile(abs);
      sections.push(`===== FILE: ${rel} =====\n${content}`);
    } catch (error) {
      console.warn('[ai-bot-poc] pinned file unavailable', { rel, error });
    }
  }
  return sections.join('\n\n');
}

const readFileInputSchema = jsonSchema<{ path: string }>({
  type: 'object',
  additionalProperties: false,
  required: ['path'],
  properties: {
    path: {
      type: 'string',
      description:
        'Path relative to the hypha-context repo root, e.g. "solution/product/treasury.md"',
    },
  },
});

/** Vercel AI SDK tool: read one more file from the context repo, repo-root-guarded. */
export function createReadFileTool(repoRoot: string) {
  return tool({
    description:
      'Read a UTF-8 text file from the hypha-context repository by its path relative to the repo root. ' +
      'Use this to pull in a file not already provided. Paths outside the repo are rejected.',
    inputSchema: readFileInputSchema,
    execute: async ({ path: requested }) => {
      const abs = resolveWithinRepo(repoRoot, requested);
      if (!abs)
        return { error: `path "${requested}" is outside the repo root` };
      try {
        const content = await readCappedTextFile(abs);
        return { path: requested, content };
      } catch (error) {
        return {
          error: `could not read "${requested}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    },
  });
}
