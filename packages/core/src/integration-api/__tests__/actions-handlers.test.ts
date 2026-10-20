import { describe, expect, it, vi } from 'vitest';

import type {
  IntegrationActionRecord,
  VoteActionContext,
} from '../../integration-action/types';
import {
  INTEGRATION_ACTION_MAX_PENDING,
  INTEGRATION_ACTION_TTL_SECONDS,
} from '../../integration-action/types';
import type { ClientAuthResult } from '../../integration-client/server/authenticate-client';
import {
  handleActionResult,
  handleApproveAction,
  handleGetClientAction,
  handleGetUserAction,
  handlePrepareAction,
  handleRejectAction,
  type IntegrationActionDeps,
} from '../actions-handlers';
import type { UserAuthResult } from '../handlers';
import { INTEGRATION_API_RESPONSE_HEADERS } from '../response-headers';

const T0 = new Date('2026-10-20T10:00:00Z');
const CLIENT = {
  id: 7,
  slug: 'acme',
  name: 'Acme Voting',
  scopes: ['agreements:vote' as const],
};
const OTHER_CLIENT = { ...CLIENT, id: 8, slug: 'other', name: 'Other App' };
const USER = { id: 42, email: 'pat@example.com', name: 'Pat', slug: 'pat' };
const OTHER_USER = { id: 43, name: 'Sam', slug: 'sam' };
const TX = `0x${'ab'.repeat(32)}`;

const CONTEXT: VoteActionContext = {
  spaceTitle: 'Garden Collective',
  proposalTitle: 'Plant more trees',
  web3ProposalId: 12,
};

const clientOk = (client = CLIENT): ClientAuthResult => ({ ok: true, client });
const userOk = (user = USER): UserAuthResult => ({ ok: true, user });

/**
 * In-memory deps with the same transition rules as the SQL (conditional
 * updates), so the tests exercise binding, single use and expiry as a whole.
 */
function makeDeps(
  over: {
    client?: ClientAuthResult;
    user?: UserAuthResult;
    now?: { value: Date };
    target?: Awaited<ReturnType<IntegrationActionDeps['resolveVoteTarget']>>;
  } = {},
) {
  const rows: (IntegrationActionRecord & { clientName: string })[] = [];
  const clock = over.now ?? { value: T0 };
  const names = new Map([
    [CLIENT.id, CLIENT.name],
    [OTHER_CLIENT.id, OTHER_CLIENT.name],
  ]);

  const deps = {
    authenticateClient: vi.fn(async () => over.client ?? clientOk()),
    authenticateUser: vi.fn(async () => over.user ?? userOk()),
    resolveVoteTarget: vi.fn(
      async () => over.target ?? { ok: true as const, context: CONTEXT },
    ),
    countPendingActions: vi.fn(
      async ({ clientId, personId, now }) =>
        rows.filter(
          (r) =>
            r.clientId === clientId &&
            r.personId === personId &&
            r.status === 'pending' &&
            r.expiresAt > now,
        ).length,
    ),
    createAction: vi.fn(async (args) => {
      const row = {
        ...args,
        id: `00000000-0000-4000-8000-${String(rows.length + 1).padStart(
          12,
          '0',
        )}`,
        status: 'pending' as const,
        resolvedAt: null,
        txHash: null,
        createdAt: clock.value,
        clientName: names.get(args.clientId) ?? 'unknown',
      };
      rows.push(row);
      return row;
    }),
    findActionForClientPerson: vi.fn(
      async ({ id, clientId, personId }) =>
        rows.find(
          (r) =>
            r.id === id && r.clientId === clientId && r.personId === personId,
        ) ?? null,
    ),
    findActionForPerson: vi.fn(
      async ({ id, personId }) =>
        rows.find((r) => r.id === id && r.personId === personId) ?? null,
    ),
    claimPendingAction: vi.fn(async ({ id, personId, to, now }) => {
      const row = rows.find(
        (r) =>
          r.id === id &&
          r.personId === personId &&
          r.status === 'pending' &&
          r.expiresAt > now,
      );
      if (!row) return null;
      row.status = to;
      return row;
    }),
    recordActionResult: vi.fn(async ({ id, personId, result }) => {
      const row = rows.find(
        (r) =>
          r.id === id && r.personId === personId && r.status === 'approved',
      );
      if (!row) return null;
      row.status = result.outcome;
      row.txHash = result.outcome === 'submitted' ? result.txHash : null;
      return row;
    }),
    approvalUrl: (id: string) => `https://hypha.test/en/approve/${id}`,
    now: () => clock.value,
  } satisfies IntegrationActionDeps;
  return { deps, rows, clock };
}

const PREPARE_BODY = {
  operation: 'vote',
  spaceSlug: 'garden',
  proposalSlug: 'plant-more-trees',
  choice: 'yes',
};
const post = (body?: unknown) =>
  new Request('https://hypha.test/x', {
    method: 'POST',
    headers: { authorization: 'Bearer user-token' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const get = () => new Request('https://hypha.test/x');

function expectHeaders(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe(
    INTEGRATION_API_RESPONSE_HEADERS['Cache-Control'],
  );
  expect(response.headers.get('Vary')).toBe(
    INTEGRATION_API_RESPONSE_HEADERS.Vary,
  );
}

async function prepared(deps: IntegrationActionDeps) {
  const response = await handlePrepareAction(post(PREPARE_BODY), deps);
  expect(response.status).toBe(202);
  return (await response.json()) as {
    actionId: string;
    approvalUrl: string;
    expiresAt: string;
    status: string;
  };
}

describe('POST actions (prepare)', () => {
  it('stores the action and answers 202 with the approval URL and expiry', async () => {
    const { deps, rows } = makeDeps();
    const response = await handlePrepareAction(post(PREPARE_BODY), deps);
    expect(response.status).toBe(202);
    expectHeaders(response);
    const body = await response.json();
    expect(body.status).toBe('pending');
    expect(body.approvalUrl).toBe(
      `https://hypha.test/en/approve/${body.actionId}`,
    );
    expect(new Date(body.expiresAt).getTime()).toBe(
      T0.getTime() + INTEGRATION_ACTION_TTL_SECONDS * 1000,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clientId: CLIENT.id,
      personId: USER.id,
      operation: 'vote',
      parameters: {
        spaceSlug: 'garden',
        proposalSlug: 'plant-more-trees',
        choice: 'yes',
      },
      context: CONTEXT,
      status: 'pending',
    });
  });

  it('takes client and person from the credentials, never from the body', async () => {
    const { deps, rows } = makeDeps();
    await handlePrepareAction(
      post({ ...PREPARE_BODY, clientId: 999, personId: 999 }),
      deps,
    );
    expect(rows[0]).toMatchObject({ clientId: CLIENT.id, personId: USER.id });
  });

  it('401 without client key or user token, nothing stored', async () => {
    const noKey = makeDeps({
      client: {
        ok: false,
        status: 401,
        code: 'missing_key',
        error: 'Missing client key.',
      },
    });
    expect(
      (await handlePrepareAction(post(PREPARE_BODY), noKey.deps)).status,
    ).toBe(401);
    const noUser = makeDeps({
      user: { ok: false, status: 401, error: 'Unauthorized' },
    });
    const response = await handlePrepareAction(post(PREPARE_BODY), noUser.deps);
    expect(response.status).toBe(401);
    expectHeaders(response);
    expect(noKey.rows).toHaveLength(0);
    expect(noUser.rows).toHaveLength(0);
  });

  it('403 when the client does not hold the vote scope', async () => {
    const { deps, rows } = makeDeps({
      client: clientOk({ ...CLIENT, scopes: [] as never }),
    });
    const response = await handlePrepareAction(post(PREPARE_BODY), deps);
    expect(response.status).toBe(403);
    expect(rows).toHaveLength(0);
  });

  it('400 on an unknown operation or choice', async () => {
    const { deps, rows } = makeDeps();
    for (const bad of [
      { ...PREPARE_BODY, operation: 'transfer' },
      { ...PREPARE_BODY, choice: 'maybe' },
      { ...PREPARE_BODY, spaceSlug: '' },
    ]) {
      const response = await handlePrepareAction(post(bad), deps);
      expect(response.status).toBe(400);
      expectHeaders(response);
    }
    expect((await handlePrepareAction(post(), deps)).status).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it('passes the failure of the existing read logic through (not a member, closed)', async () => {
    const { deps, rows } = makeDeps({
      target: {
        ok: false,
        status: 409,
        error: 'This person cannot vote on this proposal right now',
        code: 'cannot_vote',
        reason: 'not_member_or_delegate',
      },
    });
    const response = await handlePrepareAction(post(PREPARE_BODY), deps);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'cannot_vote',
      reason: 'not_member_or_delegate',
    });
    expect(rows).toHaveLength(0);
  });

  it('forwards the user token to the eligibility check', async () => {
    const { deps } = makeDeps();
    await handlePrepareAction(post(PREPARE_BODY), deps);
    expect(deps.resolveVoteTarget).toHaveBeenCalledWith({
      authorization: 'Bearer user-token',
      spaceSlug: 'garden',
      proposalSlug: 'plant-more-trees',
    });
  });

  it('429 after too many open actions for the same person and client', async () => {
    const { deps, rows } = makeDeps();
    for (let i = 0; i < INTEGRATION_ACTION_MAX_PENDING; i++) {
      await prepared(deps);
    }
    const response = await handlePrepareAction(post(PREPARE_BODY), deps);
    expect(response.status).toBe(429);
    expect(rows).toHaveLength(INTEGRATION_ACTION_MAX_PENDING);
  });
});

describe('GET actions/{id} (client polling): binding', () => {
  it('shows the status to the owning client and person', async () => {
    const { deps } = makeDeps();
    const { actionId } = await prepared(deps);
    const response = await handleGetClientAction(get(), deps, actionId);
    expect(response.status).toBe(200);
    expectHeaders(response);
    expect(await response.json()).toEqual({
      actionId,
      operation: 'vote',
      status: 'pending',
      expiresAt: new Date(
        T0.getTime() + INTEGRATION_ACTION_TTL_SECONDS * 1000,
      ).toISOString(),
      txHash: null,
    });
  });

  it('404 for another client, even with the right user', async () => {
    const owner = makeDeps();
    const { actionId } = await prepared(owner.deps);
    const intruder = makeDeps({ client: clientOk(OTHER_CLIENT) });
    intruder.rows.push(...owner.rows);
    const response = await handleGetClientAction(
      get(),
      intruder.deps,
      actionId,
    );
    expect(response.status).toBe(404);
    expectHeaders(response);
  });

  it('404 for another user, even with the right client', async () => {
    const owner = makeDeps();
    const { actionId } = await prepared(owner.deps);
    const intruder = makeDeps({ user: userOk(OTHER_USER) });
    intruder.rows.push(...owner.rows);
    expect(
      (await handleGetClientAction(get(), intruder.deps, actionId)).status,
    ).toBe(404);
  });

  it('404 for an id that is not a UUID or does not exist, 401 without credentials', async () => {
    const { deps } = makeDeps();
    expect((await handleGetClientAction(get(), deps, 'abc')).status).toBe(404);
    expect(
      (
        await handleGetClientAction(
          get(),
          deps,
          '00000000-0000-4000-8000-0000000000ff',
        )
      ).status,
    ).toBe(404);
    const anonymous = makeDeps({
      user: { ok: false, status: 401, error: 'Unauthorized' },
    });
    expect(
      (await handleGetClientAction(get(), anonymous.deps, 'x')).status,
    ).toBe(401);
  });
});

describe('approval page routes: binding to the person', () => {
  it('404 for a different signed-in person on every page route', async () => {
    const owner = makeDeps();
    const { actionId } = await prepared(owner.deps);
    const intruder = makeDeps({ user: userOk(OTHER_USER) });
    intruder.rows.push(...owner.rows);
    for (const handler of [
      handleGetUserAction,
      handleApproveAction,
      handleRejectAction,
    ]) {
      const response = await handler(post(), intruder.deps, actionId);
      expect(response.status).toBe(404);
      expectHeaders(response);
    }
    const result = await handleActionResult(
      post({ outcome: 'submitted', txHash: TX }),
      intruder.deps,
      actionId,
    );
    expect(result.status).toBe(404);
    expect(owner.rows[0].status).toBe('pending');
  });

  it('401 without a user token', async () => {
    const { deps } = makeDeps({
      user: { ok: false, status: 401, error: 'Unauthorized' },
    });
    const response = await handleGetUserAction(get(), deps, 'x');
    expect(response.status).toBe(401);
    expectHeaders(response);
  });
});

describe('summary shown on the approval page', () => {
  it('is built from the stored action and the registered client name', async () => {
    const { deps, rows } = makeDeps();
    const { actionId } = await prepared(deps);
    // Whatever the client sent as free text, only the stored fields count.
    const response = await handleGetUserAction(get(), deps, actionId);
    const body = await response.json();
    expect(body.client).toEqual({ name: 'Acme Voting' });
    expect(body.summary.headline).toContain('Acme Voting');
    expect(body.summary.lines).toEqual([
      { label: 'Application', value: 'Acme Voting' },
      { label: 'Space', value: 'Garden Collective' },
      { label: 'Proposal', value: 'Plant more trees' },
      { label: 'Your vote', value: 'Yes (in favour)' },
    ]);

    rows[0].parameters = { ...rows[0].parameters, choice: 'no' };
    const changed = await (
      await handleGetUserAction(get(), deps, actionId)
    ).json();
    expect(changed.summary.lines.at(-1)).toEqual({
      label: 'Your vote',
      value: 'No (against)',
    });
  });

  it('ignores extra text fields sent by the client', async () => {
    const { deps } = makeDeps();
    const response = await handlePrepareAction(
      post({
        ...PREPARE_BODY,
        summary: 'Send all funds',
        title: 'Phishing',
        clientName: 'Hypha Support',
      }),
      deps,
    );
    const { actionId } = await response.json();
    const text = JSON.stringify(
      await (await handleGetUserAction(get(), deps, actionId)).json(),
    );
    expect(text).not.toContain('Send all funds');
    expect(text).not.toContain('Phishing');
    expect(text).not.toContain('Hypha Support');
  });

  it('does not reveal the signing parameters before approval', async () => {
    const { deps } = makeDeps();
    const { actionId } = await prepared(deps);
    const body = await (
      await handleGetUserAction(get(), deps, actionId)
    ).json();
    expect(JSON.stringify(body)).not.toContain('web3ProposalId');
    expect(body.sign).toBeUndefined();
  });
});

describe('approve, single use, result', () => {
  it('approve claims once and returns the stored proposal and choice', async () => {
    const { deps, rows } = makeDeps();
    const { actionId } = await prepared(deps);
    const first = await handleApproveAction(post(), deps, actionId);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      actionId,
      status: 'approved',
      sign: { operation: 'vote', web3ProposalId: 12, support: true },
    });
    expect(rows[0].status).toBe('approved');

    const second = await handleApproveAction(post(), deps, actionId);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ status: 'approved' });
  });

  it('a rejected action cannot be approved afterwards', async () => {
    const { deps } = makeDeps();
    const { actionId } = await prepared(deps);
    expect((await handleRejectAction(post(), deps, actionId)).status).toBe(200);
    const again = await handleApproveAction(post(), deps, actionId);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ status: 'rejected' });
    const polled = await (
      await handleGetClientAction(get(), deps, actionId)
    ).json();
    expect(polled.status).toBe('rejected');
  });

  it('records the transaction once and the client sees submitted', async () => {
    const { deps } = makeDeps();
    const { actionId } = await prepared(deps);
    await handleApproveAction(post(), deps, actionId);
    const done = await handleActionResult(
      post({ outcome: 'submitted', txHash: TX }),
      deps,
      actionId,
    );
    expect(done.status).toBe(200);
    expect(await done.json()).toMatchObject({
      status: 'submitted',
      txHash: TX,
    });
    const polled = await (
      await handleGetClientAction(get(), deps, actionId)
    ).json();
    expect(polled).toMatchObject({ status: 'submitted', txHash: TX });

    const replay = await handleActionResult(
      post({ outcome: 'failed' }),
      deps,
      actionId,
    );
    expect(replay.status).toBe(409);
  });

  it('a result cannot be reported for an action that was never approved', async () => {
    const { deps, rows } = makeDeps();
    const { actionId } = await prepared(deps);
    const response = await handleActionResult(
      post({ outcome: 'submitted', txHash: TX }),
      deps,
      actionId,
    );
    expect(response.status).toBe(409);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].txHash).toBeNull();
  });

  it('records failed, and validates the result body', async () => {
    const { deps } = makeDeps();
    const { actionId } = await prepared(deps);
    await handleApproveAction(post(), deps, actionId);
    for (const bad of [
      { outcome: 'submitted', txHash: 'not-a-hash' },
      { outcome: 'submitted' },
      { outcome: 'weird' },
    ]) {
      expect((await handleActionResult(post(bad), deps, actionId)).status).toBe(
        400,
      );
    }
    const failed = await handleActionResult(
      post({ outcome: 'failed' }),
      deps,
      actionId,
    );
    expect(await failed.json()).toMatchObject({
      status: 'failed',
      txHash: null,
    });
  });
});

describe('expiry', () => {
  it('reads as expired after the lifetime and cannot be approved or rejected', async () => {
    const { deps, clock, rows } = makeDeps();
    const { actionId } = await prepared(deps);
    clock.value = new Date(
      T0.getTime() + INTEGRATION_ACTION_TTL_SECONDS * 1000 + 1,
    );

    const polled = await (
      await handleGetClientAction(get(), deps, actionId)
    ).json();
    expect(polled.status).toBe('expired');
    const page = await (
      await handleGetUserAction(get(), deps, actionId)
    ).json();
    expect(page.status).toBe('expired');

    for (const handler of [handleApproveAction, handleRejectAction]) {
      const response = await handler(post(), deps, actionId);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ status: 'expired' });
    }
    expect(rows[0].status).toBe('pending');
  });

  it('is still valid one second before the lifetime ends', async () => {
    const { deps, clock } = makeDeps();
    const { actionId } = await prepared(deps);
    clock.value = new Date(
      T0.getTime() + INTEGRATION_ACTION_TTL_SECONDS * 1000 - 1000,
    );
    expect((await handleApproveAction(post(), deps, actionId)).status).toBe(
      200,
    );
  });

  it('expired actions do not count towards the pending cap', async () => {
    const { deps, clock } = makeDeps();
    for (let i = 0; i < INTEGRATION_ACTION_MAX_PENDING; i++) {
      await prepared(deps);
    }
    clock.value = new Date(
      T0.getTime() + INTEGRATION_ACTION_TTL_SECONDS * 1000 + 1,
    );
    expect((await handlePrepareAction(post(PREPARE_BODY), deps)).status).toBe(
      202,
    );
  });
});
