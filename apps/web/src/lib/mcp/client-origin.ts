import 'server-only';
import { sql } from 'drizzle-orm';
import { mcpClientOrigin, type Origin } from '@hypha-platform/core/server';

/** The name lookup never holds a write back longer than this. */
export const CLIENT_NAME_LOOKUP_TIMEOUT_MS = 1500;

type QueryRunner = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

function firstName(result: unknown): string | null {
  const rows = Array.isArray(result)
    ? result
    : (result as { rows?: unknown[] } | null)?.rows;
  const name = (rows?.[0] as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' && name.trim().length > 0 ? name : null;
}

/**
 * The name the authorization server stored for an OAuth client (registered metadata or the
 * client's own metadata document). Self-declared by the client, so unverified. A failed or slow
 * lookup gives `null`: the origin is still recorded, with the client id only.
 */
export async function lookupClientName(
  clientId: string,
  { db }: { db: QueryRunner },
  timeoutMs = CLIENT_NAME_LOOKUP_TIMEOUT_MS,
): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A Drizzle query runs again on every .then/.catch, so settle it into one real promise.
    const query = Promise.resolve(
      db.execute(
        sql`select name from as_oauth_client where "clientId" = ${clientId} limit 1`,
      ),
    );
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const result = await Promise.race([query, timeout]);
    return result === null ? null : firstName(result);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The origin of a write made through the MCP: the client id from the verified token
 * (`Caller.via.clientId`) and the client's stored name. The MCP never reaches a write without a
 * client id; a token without one is refused rather than recorded as anonymous.
 */
export async function resolveMcpClientOrigin(
  clientId: string | null | undefined,
  deps: { db: QueryRunner },
): Promise<Origin> {
  const id = clientId?.trim();
  if (!id) throw new Error('An MCP write needs the client id of the token');
  const clientName = await lookupClientName(id, deps);
  return mcpClientOrigin({ clientId: id, clientName });
}
