import {
  INTEGRATION_ACTION_MAX_PENDING,
  INTEGRATION_ACTION_TTL_SECONDS,
  describeIntegrationAction,
  effectiveActionStatus,
  toClientAction,
  type IntegrationActionRecord,
  type IntegrationActionWithClient,
  type VoteActionContext,
  type VoteActionParameters,
} from '../integration-action/types';
import {
  schemaActionResult,
  schemaPrepareIntegrationAction,
} from '../integration-action/validation';
import type { VoteTargetResult } from '../integration-action/server/vote-target';
import {
  authenticateClientAndUser,
  invalidJson,
  logFailure,
  readOptionalJson,
  serverError,
  userAuthFailure,
  type IntegrationApiDeps,
} from './handlers';
import { integrationJson } from './response-headers';

/**
 * Spike (#2515, milestone 04b): prepare, approve on a Hypha page, submit. The
 * client prepares an action and polls it; the person approves it on a Hypha
 * origin and signs with their own wallet in the browser. Everything the
 * handlers need from outside is listed here so they stay testable with fakes.
 */
export type IntegrationActionDeps = Pick<
  IntegrationApiDeps,
  'authenticateClient' | 'authenticateUser'
> & {
  resolveVoteTarget(args: {
    authorization: string | null;
    spaceSlug: string;
    proposalSlug: string;
  }): Promise<VoteTargetResult>;
  countPendingActions(args: {
    clientId: number;
    personId: number;
    now: Date;
  }): Promise<number>;
  createAction(args: {
    clientId: number;
    personId: number;
    operation: 'vote';
    parameters: VoteActionParameters;
    context: VoteActionContext;
    expiresAt: Date;
  }): Promise<IntegrationActionRecord>;
  findActionForClientPerson(args: {
    id: string;
    clientId: number;
    personId: number;
  }): Promise<IntegrationActionRecord | null>;
  findActionForPerson(args: {
    id: string;
    personId: number;
  }): Promise<IntegrationActionWithClient | null>;
  claimPendingAction(args: {
    id: string;
    personId: number;
    to: 'approved' | 'rejected';
    now: Date;
  }): Promise<IntegrationActionRecord | null>;
  recordActionResult(args: {
    id: string;
    personId: number;
    result: { outcome: 'submitted'; txHash: string } | { outcome: 'failed' };
    now: Date;
  }): Promise<IntegrationActionRecord | null>;
  /** The absolute URL of the approval page for an action. */
  approvalUrl(actionId: string): string;
  now(): Date;
};

const VOTE_SCOPE = 'agreements:vote';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () => integrationJson({ error: 'Not found' }, { status: 404 });

/**
 * POST actions (client key + user token). Validates with the existing read
 * logic, stores the exact operation and answers `202` with the approval URL.
 */
export async function handlePrepareAction(
  request: Request,
  deps: IntegrationActionDeps,
): Promise<Response> {
  const auth = await authenticateClientAndUser(request, deps);
  if (!auth.ok) return auth.response;

  if (!auth.client.scopes.includes(VOTE_SCOPE)) {
    return integrationJson(
      {
        error: 'This client may not prepare this operation',
        code: 'missing_scope',
      },
      { status: 403 },
    );
  }

  const parsedBody = await readOptionalJson(request);
  if (!parsedBody.ok) return invalidJson();
  const parsed = schemaPrepareIntegrationAction.safeParse(parsedBody.body);
  if (!parsed.success) {
    return integrationJson(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const now = deps.now();

  try {
    const pending = await deps.countPendingActions({
      clientId: auth.client.id,
      personId: auth.user.id,
      now,
    });
    if (pending >= INTEGRATION_ACTION_MAX_PENDING) {
      return integrationJson(
        {
          error: 'Too many pending actions for this person',
          code: 'too_many_pending',
        },
        { status: 429 },
      );
    }

    const target = await deps.resolveVoteTarget({
      authorization: request.headers.get('authorization'),
      spaceSlug: input.spaceSlug,
      proposalSlug: input.proposalSlug,
    });
    if (!target.ok) {
      return integrationJson(
        {
          error: target.error,
          ...(target.code && { code: target.code }),
          ...(target.reason && { reason: target.reason }),
        },
        { status: target.status },
      );
    }

    const action = await deps.createAction({
      clientId: auth.client.id,
      personId: auth.user.id,
      operation: input.operation,
      parameters: {
        spaceSlug: input.spaceSlug,
        proposalSlug: input.proposalSlug,
        choice: input.choice,
      },
      context: target.context,
      expiresAt: new Date(
        now.getTime() + INTEGRATION_ACTION_TTL_SECONDS * 1000,
      ),
    });

    return integrationJson(
      {
        actionId: action.id,
        status: 'pending',
        approvalUrl: deps.approvalUrl(action.id),
        expiresAt: action.expiresAt.toISOString(),
      },
      { status: 202 },
    );
  } catch (error) {
    logFailure('prepare integration action', {}, error);
    return serverError('Failed to prepare the action');
  }
}

/**
 * GET actions/{id} (client key + user token). Only the client that prepared
 * the action, for the person it was prepared for; anyone else gets `404`.
 */
export async function handleGetClientAction(
  request: Request,
  deps: IntegrationActionDeps,
  id: string,
): Promise<Response> {
  const auth = await authenticateClientAndUser(request, deps);
  if (!auth.ok) return auth.response;
  if (!UUID.test(id)) return notFound();

  try {
    const action = await deps.findActionForClientPerson({
      id,
      clientId: auth.client.id,
      personId: auth.user.id,
    });
    if (!action) return notFound();
    return integrationJson(toClientAction(action, deps.now()));
  } catch (error) {
    logFailure('read integration action', {}, error);
    return serverError('Failed to read the action');
  }
}

/** The approval page's own authentication: the user token only. */
async function authenticateOwner(
  request: Request,
  deps: IntegrationActionDeps,
) {
  const userAuth = await deps.authenticateUser(request);
  return userAuth.ok
    ? ({ ok: true, user: userAuth.user } as const)
    : ({ ok: false, response: userAuthFailure(userAuth) } as const);
}

/**
 * GET users/me/actions/{id} (user token). What the approval page shows: the
 * summary is generated here from the stored action, never from client text.
 */
export async function handleGetUserAction(
  request: Request,
  deps: IntegrationActionDeps,
  id: string,
): Promise<Response> {
  const auth = await authenticateOwner(request, deps);
  if (!auth.ok) return auth.response;
  if (!UUID.test(id)) return notFound();

  try {
    const found = await deps.findActionForPerson({
      id,
      personId: auth.user.id,
    });
    if (!found) return notFound();
    const now = deps.now();
    return integrationJson({
      actionId: found.id,
      operation: found.operation,
      status: effectiveActionStatus(found, now),
      expiresAt: found.expiresAt.toISOString(),
      client: { name: found.clientName },
      summary: describeIntegrationAction(found, found.clientName),
    });
  } catch (error) {
    logFailure('read integration action for approval', {}, error);
    return serverError('Failed to read the action');
  }
}

/** Why a claim found nothing: unknown to this person, or no longer pending. */
async function explainUnclaimable(
  deps: IntegrationActionDeps,
  id: string,
  personId: number,
): Promise<Response> {
  const found = await deps.findActionForPerson({ id, personId });
  if (!found) return notFound();
  return integrationJson(
    {
      error: 'This request can no longer be answered',
      status: effectiveActionStatus(found, deps.now()),
    },
    { status: 409 },
  );
}

/**
 * POST users/me/actions/{id}/approve (user token). Claims the action once
 * (`pending -> approved`) and returns what the page must sign. The signing
 * parameters come from the stored action, never from the page URL.
 */
export async function handleApproveAction(
  request: Request,
  deps: IntegrationActionDeps,
  id: string,
): Promise<Response> {
  const auth = await authenticateOwner(request, deps);
  if (!auth.ok) return auth.response;
  if (!UUID.test(id)) return notFound();

  try {
    const claimed = await deps.claimPendingAction({
      id,
      personId: auth.user.id,
      to: 'approved',
      now: deps.now(),
    });
    if (!claimed) return explainUnclaimable(deps, id, auth.user.id);
    return integrationJson({
      actionId: claimed.id,
      status: claimed.status,
      sign: {
        operation: claimed.operation,
        web3ProposalId: claimed.context.web3ProposalId,
        support: claimed.parameters.choice === 'yes',
      },
    });
  } catch (error) {
    logFailure('approve integration action', {}, error);
    return serverError('Failed to approve the action');
  }
}

/** POST users/me/actions/{id}/reject (user token): `pending -> rejected`, once. */
export async function handleRejectAction(
  request: Request,
  deps: IntegrationActionDeps,
  id: string,
): Promise<Response> {
  const auth = await authenticateOwner(request, deps);
  if (!auth.ok) return auth.response;
  if (!UUID.test(id)) return notFound();

  try {
    const claimed = await deps.claimPendingAction({
      id,
      personId: auth.user.id,
      to: 'rejected',
      now: deps.now(),
    });
    if (!claimed) return explainUnclaimable(deps, id, auth.user.id);
    return integrationJson({ actionId: claimed.id, status: claimed.status });
  } catch (error) {
    logFailure('reject integration action', {}, error);
    return serverError('Failed to reject the action');
  }
}

/**
 * POST users/me/actions/{id}/result (user token). The page reports what its
 * wallet did after `approve`: `submitted` with the transaction hash, or
 * `failed`. Only an `approved` action can take a result, once.
 */
export async function handleActionResult(
  request: Request,
  deps: IntegrationActionDeps,
  id: string,
): Promise<Response> {
  const auth = await authenticateOwner(request, deps);
  if (!auth.ok) return auth.response;
  if (!UUID.test(id)) return notFound();

  const parsedBody = await readOptionalJson(request);
  if (!parsedBody.ok) return invalidJson();
  const parsed = schemaActionResult.safeParse(parsedBody.body);
  if (!parsed.success) {
    return integrationJson(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const recorded = await deps.recordActionResult({
      id,
      personId: auth.user.id,
      result: parsed.data,
      now: deps.now(),
    });
    if (!recorded) return explainUnclaimable(deps, id, auth.user.id);
    return integrationJson({
      actionId: recorded.id,
      status: recorded.status,
      txHash: recorded.txHash,
    });
  } catch (error) {
    logFailure('record integration action result', {}, error);
    return serverError('Failed to record the result');
  }
}
