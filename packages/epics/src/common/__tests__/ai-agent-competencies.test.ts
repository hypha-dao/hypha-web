import { describe, expect, it } from 'vitest';

import {
  detectAiAgentsForQuestion,
  resolveMobilizedAgentsForAssistantMessage,
} from '../ai-agent-competencies';

describe('detectAiAgentsForQuestion', () => {
  it('mobilizes governance for the Next signal suggestion (singular)', () => {
    const agents = detectAiAgentsForQuestion(
      'What signal should we create or share next?',
    );
    expect(agents.map((agent) => agent.id)).toContain('governance');
  });

  it('mobilizes governance for plural signals wording', () => {
    const agents = detectAiAgentsForQuestion(
      'What signals should we create or share next?',
    );
    expect(agents.map((agent) => agent.id)).toContain('governance');
  });
});

describe('resolveMobilizedAgentsForAssistantMessage', () => {
  it('associates specialists with the assistant reply after the user ask', () => {
    const messages = [
      {
        role: 'user' as const,
        parts: [
          {
            type: 'text',
            text: 'What signal should we create or share next?',
          },
        ],
      },
      {
        role: 'assistant' as const,
        parts: [{ type: 'text', text: 'Proposed Signal: …' }],
      },
    ];

    expect(resolveMobilizedAgentsForAssistantMessage(messages, 0)).toEqual([]);
    expect(
      resolveMobilizedAgentsForAssistantMessage(messages, 1).map(
        (agent) => agent.id,
      ),
    ).toContain('governance');
  });
});
