import { afterEach, describe, expect, it } from 'vitest';

import { withMatrixAgentMention } from '../matrix-agent-mention';

const BOT_USER_ID = '@ai-agents:example.org';

const SKILLS = [
  { id: 'tension', prompt: 'What tension do you see?' },
  { id: 'opportunity', prompt: 'What opportunity do you see?' },
  { id: 'need', prompt: 'How would you phrase the need?' },
  { id: 'resources', prompt: 'What resources does this need?' },
] as const;

describe('withMatrixAgentMention', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID;
  });

  it('puts one AI Agents row ahead of the roster, with the skill questions on it', () => {
    process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID = BOT_USER_ID;
    const ada = { userId: '@ada:example.org', displayLabel: 'Ada Lovelace' };
    const roster = [ada, { userId: BOT_USER_ID, displayLabel: 'Bot Person' }];

    const rows = withMatrixAgentMention(roster, 'AI Agents', SKILLS, {
      kind: 'network',
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      userId: BOT_USER_ID,
      displayLabel: 'AI Agents',
      rowKey: 'agent',
      agentIcon: { kind: 'network' },
      skills: SKILLS.map((skill) => ({ id: skill.id, prompt: skill.prompt })),
    });
    expect(rows[0]?.prompt).toBeUndefined();
    expect(rows[1]).toEqual(ada);
    expect(rows.some((row) => row.displayLabel === 'Bot Person')).toBe(false);
  });

  it('returns the roster unchanged when the bot user id is unset', () => {
    const roster = [{ userId: '@ada:example.org', displayLabel: 'Ada' }];
    expect(withMatrixAgentMention(roster, 'AI Agents', SKILLS)).toEqual(roster);
  });
});
