import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WELLBEING_MODE,
  WELLBEING_MODES,
  axesFromGridPointer,
  averageScore,
  extractTopics,
  feelingFromScore,
  isWellbeingMode,
  momentMode,
  parseTopicsInput,
  preferredModeFor,
  scoreFromAxes,
} from '../wellbeing-model';

describe('wellbeing-model', () => {
  it('weights felt more than impact', () => {
    expect(scoreFromAxes(100, 0)).toBe(55);
    expect(scoreFromAxes(0, 100)).toBe(45);
    expect(scoreFromAxes(50, 50)).toBe(50);
  });

  it('maps grid x to sad→happy felt and y to high→low impact', () => {
    expect(axesFromGridPointer(0, 1)).toEqual({ felt: 0, impact: 0 });
    expect(axesFromGridPointer(1, 0)).toEqual({ felt: 100, impact: 100 });
    expect(axesFromGridPointer(0.5, 0.5)).toEqual({ felt: 50, impact: 50 });
  });

  it('maps scores to feeling words', () => {
    expect(feelingFromScore(82)).toBe('thriving');
    expect(feelingFromScore(66)).toBe('deepening');
    expect(feelingFromScore(51)).toBe('steadying');
    expect(feelingFromScore(36)).toBe('footing');
    expect(feelingFromScore(10)).toBe('tending');
  });

  it('averages moment scores', () => {
    expect(averageScore([])).toBeNull();
    expect(averageScore([{ score: 40 } as never, { score: 60 } as never])).toBe(
      50,
    );
  });

  it('treats the mode enum as standard, idg, and nvc', () => {
    expect(WELLBEING_MODES).toEqual(['standard', 'idg', 'nvc']);
    expect(isWellbeingMode('idg')).toBe(true);
    expect(isWellbeingMode('standard')).toBe(true);
    expect(isWellbeingMode('nvc')).toBe(true);
    expect(isWellbeingMode('other')).toBe(false);
    expect(DEFAULT_WELLBEING_MODE).toBe('idg');
  });

  it('reads old moments without a mode as IDG', () => {
    expect(momentMode({})).toBe('idg');
    expect(momentMode({ mode: 'nvc' })).toBe('nvc');
  });

  it('prefers a space mode over the personal default', () => {
    expect(
      preferredModeFor(
        {
          version: 1,
          personalActivated: true,
          preferredMode: 'standard',
          spaceModes: { circle: 'nvc' },
          moments: [],
          spaceAddons: {},
        },
        'circle',
      ),
    ).toBe('nvc');
    expect(
      preferredModeFor({
        version: 1,
        personalActivated: true,
        preferredMode: 'standard',
        moments: [],
        spaceAddons: {},
      }),
    ).toBe('standard');
  });

  it('extracts and normalizes topics', () => {
    expect(extractTopics('talk with #Manager about #Work')).toEqual([
      'manager',
      'work',
    ]);
    expect(parseTopicsInput('#Home, rest  Circle')).toEqual([
      'home',
      'rest',
      'circle',
    ]);
  });
});
