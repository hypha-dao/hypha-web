import { describe, expect, it } from 'vitest';

import {
  estimateSpeechDurationMs,
  prepareAssistantTextForSpeech,
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

  it('caps spoken output at two sentences', () => {
    const input =
      'First sentence here. Second sentence follows. Third should be dropped. Fourth definitely gone.';

    const spoken = prepareAssistantTextForSpeech(input);

    expect(spoken).toBe('First sentence here. Second sentence follows.');
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
