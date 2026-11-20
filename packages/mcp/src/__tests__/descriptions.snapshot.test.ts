import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESCRIPTIONS_VERSION, UNTRUSTED_LINE } from '../descriptions';
import { connect, makeDeps } from './harness';

/**
 * The text the model reads. Any change fails this snapshot on purpose: review the new text,
 * bump DESCRIPTIONS_VERSION, add a CHANGELOG line, then update the snapshot
 * (`pnpm --filter @hypha-platform/mcp test -- -u`).
 */
describe('tools/list is the reviewed text, in the fixed order', () => {
  it('matches the snapshot (order, text, schemas, annotations)', async () => {
    const { deps } = makeDeps();
    const { client, close } = await connect(deps);
    const { tools } = await client.listTools();
    const instructions = client.getInstructions();
    await close();
    expect({ instructions, tools }).toMatchSnapshot();
  });

  it('order is deterministic', async () => {
    const { deps } = makeDeps();
    const { client, close } = await connect(deps);
    const names = (await client.listTools()).tools.map((t) => t.name);
    await close();
    expect(names).toEqual([
      'hypha_list_spaces',
      'hypha_get_space',
      'hypha_list_proposals',
      'hypha_get_my_membership',
      'hypha_get_my_vote',
    ]);
  });

  it('every tool is read-only and closed-world', async () => {
    const { deps } = makeDeps();
    const { client, close } = await connect(deps);
    const { tools } = await client.listTools();
    await close();
    for (const t of tools) {
      expect(t.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
      });
    }
  });

  it('tools that return user-written text carry the untrusted-content line; the instructions too', async () => {
    const { deps } = makeDeps();
    const { client, close } = await connect(deps);
    const { tools } = await client.listTools();
    const instructions = client.getInstructions();
    await close();
    expect(
      tools.find((t) => t.name === 'hypha_list_spaces')?.description,
    ).toContain(UNTRUSTED_LINE);
    expect(instructions).toContain(UNTRUSTED_LINE);
  });

  it('every tool description says it is read-only', async () => {
    const { deps } = makeDeps();
    const { client, close } = await connect(deps);
    const { tools } = await client.listTools();
    await close();
    for (const t of tools) expect(t.description, t.name).toMatch(/read-only/i);
  });

  it('the version is in the changelog', () => {
    const changelog = readFileSync(
      new URL('../descriptions/CHANGELOG.md', import.meta.url),
      'utf8',
    );
    expect(changelog).toContain(`## ${DESCRIPTIONS_VERSION}`);
  });
});
