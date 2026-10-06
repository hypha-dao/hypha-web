import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const requestMock = vi.fn();
vi.mock('node:https', () => ({
  request: (...args: unknown[]) => requestMock(...args),
  Agent: class {
    destroy() {}
  },
}));

const proxyAgentCtor = vi.fn();
vi.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: class {
    constructor(...args: unknown[]) {
      proxyAgentCtor(...args);
    }
    destroy() {}
  },
}));

import { auddRequest } from '../audd-transport';

function respondOk() {
  requestMock.mockImplementation((_url, _opts, onResponse) => {
    const req = new EventEmitter() as EventEmitter & {
      write: () => void;
      end: () => void;
    };
    req.write = () => {};
    req.end = () => {
      const res = new EventEmitter() as EventEmitter & { statusCode: number };
      res.statusCode = 200;
      onResponse(res);
      res.emit('data', Buffer.from('{}'));
      res.emit('end');
    };
    return req;
  });
}

describe('auddRequest mTLS options', () => {
  beforeEach(() => {
    requestMock.mockReset();
    proxyAgentCtor.mockReset();
    respondOk();
  });

  it('passes the client cert/key as request options when going through the relay', async () => {
    await auddRequest({
      method: 'POST',
      path: '/customer/auth/token',
      config: {
        baseUrl: 'https://api.sandbox.audd.digital',
        apiKey: 'k',
        cert: 'CERT',
        key: 'KEY',
        httpsProxy: 'https://u:p@relay.example:28443',
      },
    });

    // https-proxy-agent v7 drops options given to its constructor, so the cert must ride on the
    // request or AUDD never sees a client certificate.
    expect(requestMock.mock.calls[0][1]).toMatchObject({
      cert: 'CERT',
      key: 'KEY',
    });
    expect(proxyAgentCtor).toHaveBeenCalledWith(
      'https://u:p@relay.example:28443',
    );
  });
});
