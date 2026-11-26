import { z } from 'zod';
import type { OriginKind, OriginView } from '@hypha-platform/core/server';
import { sanitiseUserText } from '../sanitiser';

/**
 * The origin kinds, mirrored here because this package takes `core` only as types. The two
 * checks below fail to compile if this list and core's `OriginKind` ever differ.
 */
export const ORIGIN_KIND_VALUES = [
  'app',
  'hypha_assistant',
  'mcp_client',
  'api_client',
  'space_key',
  'hypha_intelligence',
  'hypha_platform',
  'unknown',
] as const satisfies readonly OriginKind[];
type Exhaustive<T extends never> = T;
export type _OriginKindsCoverCore = Exhaustive<
  Exclude<OriginKind, (typeof ORIGIN_KIND_VALUES)[number]>
>;

/** A client names itself; its name is treated like any user-written text. */
export const ORIGIN_CLIENT_NAME_CAP = 120;

/**
 * Which path created a record (#2724): the kind (a closed list Hypha sets) and the client's
 * self-declared name. Never the client id, a person id or an address.
 */
export const originSchema = z.object({
  kind: z.enum(ORIGIN_KIND_VALUES),
  clientName: z.string().nullable(),
});
export type OriginPresented = z.infer<typeof originSchema>;

export function presentOrigin(origin: OriginView): OriginPresented {
  const clientName =
    origin.clientLabel == null
      ? null
      : sanitiseUserText(origin.clientLabel, ORIGIN_CLIENT_NAME_CAP).text;
  return { kind: origin.kind, clientName: clientName || null };
}
