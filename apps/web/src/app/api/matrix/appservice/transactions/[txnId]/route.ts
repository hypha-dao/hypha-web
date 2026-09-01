import { NextRequest, NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  getSuppressedBotUserIds,
  loggingDispatch,
  receiveTransaction,
  type MatrixTransactionBody,
} from '@hypha-platform/notifications/ingest';
import { assertHsToken } from '../../_lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * `PUT /_matrix/app/v1/transactions/{txnId}` — the homeserver pushes a batch of events here
 * (rewritten from `/_matrix/app/v1/...` in next.config, #2483).
 *
 * Durability contract (spec §4): return **200 only after** every event is durably recorded in
 * `notification_processed_events`. On any error we return **5xx** and Dendrite keeps the
 * transaction queued and replays it in order — that is the primary catch-up mechanism. So a
 * crash/DB failure mid-batch is safe (re-seen on replay, deduped by event id); a `dispatch()`
 * failure is swallowed inside `receiveTransaction` (claim-before-dispatch, at-most-once).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ txnId: string }> },
) {
  const authFailure = assertHsToken(request);
  if (authFailure) return authFailure;

  const { txnId } = await params;
  if (!txnId?.trim()) {
    return NextResponse.json(
      { errcode: 'M_UNKNOWN', error: 'missing txnId' },
      { status: 400 },
    );
  }

  let body: MatrixTransactionBody;
  try {
    body = (await request.json()) as MatrixTransactionBody;
  } catch {
    return NextResponse.json(
      { errcode: 'M_NOT_JSON', error: 'body is not valid JSON' },
      { status: 400 },
    );
  }

  try {
    const result = await receiveTransaction(
      { txnId: txnId.trim(), body },
      {
        db,
        // TODO(#2470): swap for the real notification decision/delivery dispatch().
        dispatch: loggingDispatch,
        botUserIds: getSuppressedBotUserIds(),
      },
    );
    // Spec-required ACK body is `{}`; include counts for observability (Dendrite ignores extras).
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[matrix-as] transaction processing failed', {
      txnId,
      error,
    });
    return NextResponse.json(
      { errcode: 'M_UNKNOWN', error: 'transaction not durably processed' },
      { status: 500 },
    );
  }
}
