import { afterEach, describe, expect, it } from 'vitest';
import {
  PLACE_OUTGOING_RETRY_BASE_MS,
  PLACE_OUTGOING_RETRY_EXTENDED_MS,
  isCallPairwiseRetry20sEnabled,
  resolvePlaceOutgoingRetryDelaysMs,
} from '../call-pairwise-retry-env';

describe('call-pairwise-retry-env (CSH-MESH-1)', () => {
  const original = process.env.NEXT_PUBLIC_CALL_PAIRWISE_RETRY_20S;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_CALL_PAIRWISE_RETRY_20S;
    } else {
      process.env.NEXT_PUBLIC_CALL_PAIRWISE_RETRY_20S = original;
    }
  });

  it('includes 20s retry by default', () => {
    delete process.env.NEXT_PUBLIC_CALL_PAIRWISE_RETRY_20S;
    expect(isCallPairwiseRetry20sEnabled()).toBe(true);
    expect(resolvePlaceOutgoingRetryDelaysMs()).toEqual(
      PLACE_OUTGOING_RETRY_BASE_MS,
    );
  });

  it('omits 20s retry when env flag is false', () => {
    process.env.NEXT_PUBLIC_CALL_PAIRWISE_RETRY_20S = 'false';
    expect(isCallPairwiseRetry20sEnabled()).toBe(false);
    expect(resolvePlaceOutgoingRetryDelaysMs()).toEqual(
      PLACE_OUTGOING_RETRY_BASE_MS.filter(
        (ms) => ms !== PLACE_OUTGOING_RETRY_EXTENDED_MS,
      ),
    );
  });
});
