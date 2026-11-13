import { describe, expect, it } from 'vitest';
import {
  StaleDeploymentError,
  isStaleClientBundleError,
} from '../stale-deployment';

describe('stale client bundle', () => {
  it('recognises a replaced server action and a missing chunk', () => {
    const action = new Error(
      'Server Action "60967ca92bbb299600c8c3651e2f62137cd7bf1011" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action',
    );
    expect(isStaleClientBundleError(action)).toBe(true);
    expect(
      isStaleClientBundleError(
        new Error(
          'Failed to find Server Action "abc". This request might be from an older or newer deployment.',
        ),
      ),
    ).toBe(true);
    const chunk = new Error('Loading chunk 75964 failed.');
    chunk.name = 'ChunkLoadError';
    expect(isStaleClientBundleError(chunk)).toBe(true);
    expect(
      isStaleClientBundleError(
        new Error(
          'Failed to fetch dynamically imported module https://preview/chunk.js',
        ),
      ),
    ).toBe(true);
    expect(isStaleClientBundleError(new StaleDeploymentError(null))).toBe(true);
  });

  it('leaves an ordinary publish failure alone', () => {
    expect(isStaleClientBundleError(new Error('Select a Quest Lead'))).toBe(
      false,
    );
    expect(isStaleClientBundleError('offline')).toBe(false);
  });
});
