import { describe, expect, it } from 'vitest';
import {
  averageScore,
  feelingFromScore,
  scoreFromAxes,
} from '../wellbeing-model';

describe('wellbeing-model', () => {
  it('weights felt more than impact', () => {
    expect(scoreFromAxes(100, 0)).toBe(55);
    expect(scoreFromAxes(0, 100)).toBe(45);
    expect(scoreFromAxes(50, 50)).toBe(50);
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
});
