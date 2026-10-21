import { describe, expect, it, vi } from 'vitest';

import {
  INTEGRATION_ACTION_MESSAGE_TYPE,
  buildIntegrationActionMessage,
  notifyOpener,
} from '../result-message';

const ID = '00000000-0000-4000-8000-000000000001';
const TX = `0x${'ab'.repeat(32)}`;

describe('buildIntegrationActionMessage', () => {
  it('has a fixed shape and carries the hash only with submitted', () => {
    expect(
      buildIntegrationActionMessage({
        actionId: ID,
        status: 'submitted',
        txHash: TX,
      }),
    ).toEqual({
      type: INTEGRATION_ACTION_MESSAGE_TYPE,
      version: 1,
      actionId: ID,
      status: 'submitted',
      txHash: TX,
    });
    expect(
      buildIntegrationActionMessage({
        actionId: ID,
        status: 'rejected',
        txHash: TX,
      }),
    ).toEqual({
      type: INTEGRATION_ACTION_MESSAGE_TYPE,
      version: 1,
      actionId: ID,
      status: 'rejected',
    });
  });
});

describe('notifyOpener', () => {
  const message = buildIntegrationActionMessage({
    actionId: ID,
    status: 'submitted',
    txHash: TX,
  });

  it('posts to each registered origin, never to *', () => {
    const opener = { postMessage: vi.fn() };
    const tried = notifyOpener(opener, message, [
      'https://app.example',
      'http://localhost:3001',
    ]);
    expect(tried).toBe(2);
    expect(opener.postMessage.mock.calls.map((call) => call[1])).toEqual([
      'https://app.example',
      'http://localhost:3001',
    ]);
    expect(opener.postMessage.mock.calls.every((call) => call[1] !== '*')).toBe(
      true,
    );
  });

  it('sends nothing without a registered origin or without an opener', () => {
    const opener = { postMessage: vi.fn() };
    expect(notifyOpener(opener, message, [])).toBe(0);
    expect(notifyOpener(null, message, ['https://app.example'])).toBe(0);
    expect(opener.postMessage).not.toHaveBeenCalled();
  });

  it('skips anything that is not a bare http(s) origin', () => {
    const opener = { postMessage: vi.fn() };
    const tried = notifyOpener(opener, message, [
      '*',
      'https://app.example/path',
      'https://app.example/',
      'javascript:alert(1)',
      'not a url',
      'https://ok.example',
    ]);
    expect(tried).toBe(1);
    expect(opener.postMessage).toHaveBeenCalledWith(
      message,
      'https://ok.example',
    );
  });

  it('survives an opener that throws', () => {
    const opener = {
      postMessage: vi.fn(() => {
        throw new Error('closed');
      }),
    };
    expect(notifyOpener(opener, message, ['https://app.example'])).toBe(0);
  });
});
