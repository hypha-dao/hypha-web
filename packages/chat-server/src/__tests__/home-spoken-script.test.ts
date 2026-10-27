import { describe, expect, it } from 'vitest';
import {
  homeSpokenScriptIsComplete,
  homeTurnShouldStop,
} from '../home-spoken-script';

describe('homeSpokenScriptIsComplete', () => {
  it('accepts a sentence that the voice can finish', () => {
    expect(
      homeSpokenScriptIsComplete(
        'Glad that is wrapped up, Alex. The update has landed.',
      ),
    ).toBe(true);
  });

  it('rejects a line the card tool cut off', () => {
    expect(
      homeSpokenScriptIsComplete(
        'Glad that is wrapped up, Alex. In Hypha Flywheel, a discussion summary update has landed — it points to',
      ),
    ).toBe(false);
    expect(homeSpokenScriptIsComplete('It landed —')).toBe(false);
    expect(homeSpokenScriptIsComplete('It is about:')).toBe(false);
  });
});

describe('homeTurnShouldStop', () => {
  it('keeps the turn open while the sentence is unfinished', () => {
    expect(homeTurnShouldStop([{ text: 'It points to' }])).toBe(false);
    expect(
      homeTurnShouldStop([{ text: 'It points to' }, { text: 'It points to' }]),
    ).toBe(false);
  });

  it('stops once the latest step ends the sentence', () => {
    expect(
      homeTurnShouldStop([
        { text: 'It points to' },
        { text: 'It points to the purpose they are holding.' },
      ]),
    ).toBe(true);
  });

  it('waits for words when a step has not spoken yet', () => {
    expect(homeTurnShouldStop([{ text: '' }])).toBe(false);
  });

  it('stops after three tries so a stuck line cannot loop', () => {
    expect(
      homeTurnShouldStop([
        { text: 'It points to' },
        { text: 'It points to' },
        { text: 'It points to' },
      ]),
    ).toBe(true);
  });
});
