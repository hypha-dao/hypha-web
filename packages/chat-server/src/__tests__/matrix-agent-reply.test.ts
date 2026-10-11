import { describe, expect, it } from 'vitest';
import { mentionAwaitingAgent } from '../matrix-agent-turn';

const agent = '@hypha_bot:matrix.test';

describe('mentionAwaitingAgent', () => {
  it('answers only the latest message, and only when it mentions the agent', () => {
    const turn = mentionAwaitingAgent(
      [
        {
          sender: '@alex:matrix.test',
          body: 'Hypha, what is the tension here?',
          mentionsAgent: true,
        },
        {
          sender: '@noor:matrix.test',
          body: 'The budget and the timeline disagree.',
          mentionsAgent: false,
        },
      ],
      agent,
    );
    expect(turn?.question).toContain('tension');
    expect(turn?.earlier).toContain('budget');
  });

  it('stays quiet when the latest message does not mention the agent', () => {
    expect(
      mentionAwaitingAgent(
        [
          {
            sender: '@alex:matrix.test',
            body: 'Let us keep going.',
            mentionsAgent: false,
          },
          {
            sender: '@noor:matrix.test',
            body: '@hypha_bot:matrix.test thoughts?',
            mentionsAgent: true,
          },
        ],
        agent,
      ),
    ).toBeNull();
  });

  it('stays quiet once the agent has already spoken last', () => {
    expect(
      mentionAwaitingAgent(
        [
          {
            sender: agent,
            body: 'The need is a clearer owner for the budget.',
            mentionsAgent: false,
          },
        ],
        agent,
      ),
    ).toBeNull();
  });
});
