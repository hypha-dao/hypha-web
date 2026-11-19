import { describe, expect, it } from 'vitest';
import { buildToolLogLine } from '../log';
import { makeDeps, connect, caller } from './harness';

describe('log helper is an allow-list', () => {
  it('drops everything that is not listed, whatever the input carries', () => {
    const line = buildToolLogLine({
      tool: 'hypha_list_spaces',
      outcome: 'ok',
      durationMs: 12,
      clientId: 'https://client.example/cimd.json',
      itemCount: 3,
      // planted, must never reach the log:
      token: 'eyJ.secret.token',
      authorization: 'Bearer abc',
      arguments: { query: 'private words' },
      result: { items: ['secret space'] },
      email: 'a@b.c',
    } as never);
    expect(Object.keys(line).sort()).toEqual(
      [
        'clientId',
        'durationMs',
        'event',
        'itemCount',
        'outcome',
        'tool',
      ].sort(),
    );
    const text = JSON.stringify(line);
    for (const s of [
      'eyJ',
      'Bearer',
      'private words',
      'secret space',
      'a@b.c',
    ]) {
      expect(text).not.toContain(s);
    }
  });

  it('a tool call writes exactly one line with no arguments or results in it', async () => {
    const { deps, logs } = makeDeps();
    const { client, close } = await connect(deps);
    await client.callTool({
      name: 'hypha_list_spaces',
      arguments: { query: 'very private search' },
    });
    await close();
    expect(logs).toHaveLength(1);
    const text = JSON.stringify(buildToolLogLine(logs[0]!));
    expect(text).not.toContain('very private search');
    expect(text).not.toContain(caller.address ?? 'x');
    expect(logs[0]).toMatchObject({
      tool: 'hypha_list_spaces',
      outcome: 'ok',
      itemCount: 1,
    });
  });
});
