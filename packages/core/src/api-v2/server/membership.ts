import 'server-only';

import type { DbConfig } from '../../server';
import {
  getMyMembership,
  type MyMembership,
} from '../../features/get-my-membership';
import { toV2Failure, type V2Caller, type V2Failure } from '../failure';

export type MyMembershipV2 = MyMembership;

/**
 * API presentation of the "get my membership" feature function (route
 * `memberships/me`): the body is the feature's data as is; failures map to HTTP.
 */
export async function buildMyMembershipV2(
  { spaceSlug, caller }: { spaceSlug: string; caller: V2Caller },
  config: DbConfig,
): Promise<{ ok: true; body: MyMembershipV2 } | V2Failure> {
  const r = await getMyMembership({ spaceSlug, caller }, config);
  if (!r.ok) return toV2Failure(r);
  return { ok: true, body: r.data };
}
