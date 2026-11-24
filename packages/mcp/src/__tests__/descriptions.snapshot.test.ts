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
      'hypha_list_signals',
      'hypha_list_quests',
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

  it('every tool that takes a slug says never to guess it; the instructions say what a slug is', async () => {
    const { deps } = makeDeps();
    const { client, close } = await connect(deps);
    const { tools } = await client.listTools();
    const instructions = client.getInstructions() ?? '';
    await close();
    for (const name of [
      'hypha_get_space',
      'hypha_list_proposals',
      'hypha_get_my_membership',
      'hypha_get_my_vote',
      'hypha_list_signals',
      'hypha_list_quests',
    ]) {
      expect(tools.find((t) => t.name === name)?.description, name).toMatch(
        /never guess a slug/i,
      );
    }
    expect(instructions).toMatch(/slug/);
    expect(instructions).toMatch(/sub-space/);
    expect(instructions).toMatch(/delegate/);
  });

  it('the word quest stays out of the other tools: only the proposals, signals and quests tools may use it', async () => {
    const { deps } = makeDeps();
    const { client, close } = await connect(deps);
    const { tools } = await client.listTools();
    await close();
    for (const t of tools) {
      if (
        t.name === 'hypha_list_proposals' ||
        t.name === 'hypha_list_signals' ||
        t.name === 'hypha_list_quests'
      ) {
        continue;
      }
      expect(t.description, t.name).not.toMatch(/quest/i);
    }
  });

  it('the version is in the changelog', () => {
    const changelog = readFileSync(
      new URL('../descriptions/CHANGELOG.md', import.meta.url),
      'utf8',
    );
    expect(changelog).toContain(`## ${DESCRIPTIONS_VERSION}`);
  });
});
