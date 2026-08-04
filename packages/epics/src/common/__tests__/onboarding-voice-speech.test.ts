import { describe, expect, it } from 'vitest';

import {
  estimateSpeechDurationMs,
  extractEarlySpeakableSentence,
  pickVoiceInterimAckPhrase,
  prepareAssistantTextForSpeech,
  resolveSpeechRemainderAfterEarlyPrefix,
} from '../onboarding-voice-speech';

describe('prepareAssistantTextForSpeech', () => {
  it('keeps natural spoken lead-ins and drops numbered field labels', () => {
    const input = `I'll help you update how people join. Let's start with the required fields:
1. Proposal title: Please provide a short title for the proposal.
2. Proposal description: Can you describe the rationale for changing the entry method?
3. Entry method: How would you like people to join?`;

    const spoken = prepareAssistantTextForSpeech(input);

    expect(spoken).toContain("I'll help you update how people join.");
    expect(spoken).not.toMatch(/proposal title/i);
    expect(spoken).not.toMatch(/entry method/i);
    expect(spoken).not.toMatch(/\d+\./);
  });

  it('removes bullet lists and form labels', () => {
    const input = `**Title:** Open membership
**Description:** Switch to open access
- Option one
- Option two`;

    const spoken = prepareAssistantTextForSpeech(input);

    expect(spoken).not.toMatch(/title/i);
    expect(spoken).not.toMatch(/option one/i);
  });

  it('drops quorum and numbered governance checklist lines', () => {
    const input = `I'll help with voting. Let's start with the required fields:
1. Title: What would you like to call the proposal?
2. Description: A brief explanation of the voting method.
3. Voting Method: What specific method do you want to use?
4. Quorum (%): What percentage of members need to participate?`;

    const spoken = prepareAssistantTextForSpeech(input);

    expect(spoken).toContain("I'll help with voting.");
    expect(spoken).not.toMatch(/quorum/i);
    expect(spoken).not.toMatch(/voting method/i);
  });

  it('drops discovery narration that sounds like internal planning', () => {
    const input = `It looks like I need to add a brief title and description for the proposal.
I've drafted "Issue New Token" — work for you?`;

    const spoken = prepareAssistantTextForSpeech(input);

    expect(spoken).not.toMatch(/it looks like i need/i);
    expect(spoken).toContain('Issue New Token');
  });

  it('caps spoken output at four sentences', () => {
    const input = 'One. Two. Three. Four. Five should be dropped. Six gone.';

    const spoken = prepareAssistantTextForSpeech(input);

    expect(spoken).toBe('One. Two. Three. Four.');
  });
});

describe('pickVoiceInterimAckPhrase', () => {
  it('returns localized interim ack phrases', () => {
    expect(pickVoiceInterimAckPhrase('fr')).toMatch(
      /instant|seconde|consulte/i,
    );
    expect(pickVoiceInterimAckPhrase('en')).toMatch(/moment|second|pull/i);
  });
});

describe('estimateSpeechDurationMs', () => {
  it('returns a positive duration for speakable text', () => {
    const duration = estimateSpeechDurationMs(
      'Thanks for sharing that. What would you like to call this proposal?',
    );
    expect(duration).toBeGreaterThan(500);
    expect(duration).toBeLessThan(8000);
  });

  it('returns zero for empty or stripped text', () => {
    expect(estimateSpeechDurationMs('')).toBe(0);
    expect(estimateSpeechDurationMs('**Title:** only labels')).toBe(0);
  });
});

describe('prepareAssistantSpeechSentences', () => {
  it('splits speakable text into sentence chunks', async () => {
    const { prepareAssistantSpeechSentences } = await import(
      '../onboarding-voice-speech'
    );
    const sentences = prepareAssistantSpeechSentences(
      'First point here. Second point follows! Third one?',
    );
    expect(sentences).toHaveLength(3);
  });
});

describe('extractEarlySpeakableSentence', () => {
  it('returns the first completed sentence for early TTS', () => {
    expect(
      extractEarlySpeakableSentence(
        'Let me check that for you. What should we call this space?',
      ),
    ).toBe('Let me check that for you.');
  });

  it('waits until a sentence terminator arrives', () => {
    expect(
      extractEarlySpeakableSentence('Let me check that for you'),
    ).toBeNull();
  });

  it('ignores tiny fragments', () => {
    expect(extractEarlySpeakableSentence('OK.')).toBeNull();
  });
});

describe('resolveSpeechRemainderAfterEarlyPrefix', () => {
  it('returns substantial text after the early lead-in', () => {
    const remainder = resolveSpeechRemainderAfterEarlyPrefix(
      'Let me check that for you. I drafted a name based on what you shared — want to use "Sunrise Collective"?',
      'Let me check that for you.',
    );
    expect(remainder).toContain('Sunrise Collective');
  });

  it('skips short remainders already covered by the lead-in', () => {
    expect(
      resolveSpeechRemainderAfterEarlyPrefix(
        'Let me check that for you. Done.',
        'Let me check that for you.',
      ),
    ).toBe('');
  });

  it('keeps a short remainder that asks the next question', () => {
    expect(
      resolveSpeechRemainderAfterEarlyPrefix(
        'Let me check that for you. What should we call this space?',
        'Let me check that for you.',
      ),
    ).toBe('What should we call this space?');
  });

  it('drops a normalized first-sentence match instead of replaying the lead-in', () => {
    expect(
      resolveSpeechRemainderAfterEarlyPrefix(
        'Let me check that for you! What should we call this space?',
        'Let me check that for you.',
      ),
    ).toBe('What should we call this space?');
  });

  it('falls back to the full script when the prefix no longer matches', () => {
    expect(
      resolveSpeechRemainderAfterEarlyPrefix(
        'Here is a fresh recommendation for your space name.',
        'Let me check that for you.',
      ),
    ).toBe('Here is a fresh recommendation for your space name.');
  });
});
