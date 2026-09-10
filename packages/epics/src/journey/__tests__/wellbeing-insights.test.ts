import { describe, expect, it } from 'vitest';
import { buildWellbeingInsights } from '../wellbeing-insights';
import type { WellbeingMoment } from '../wellbeing-model';

function moment(
  partial: Partial<WellbeingMoment> & Pick<WellbeingMoment, 'score'>,
): WellbeingMoment {
  return {
    id: partial.id ?? `m-${partial.score}`,
    createdAt: partial.createdAt ?? '2026-08-25T12:00:00.000Z',
    personSlug: 'ada',
    scope: 'personal',
    dimension: 'relating',
    practiceId: 'empathy',
    felt: 50,
    impact: 50,
    title: 'A named moment',
    ...partial,
  };
}

describe('wellbeing-insights', () => {
  it('speaks into an empty field without inventing a score', () => {
    const pulse = buildWellbeingInsights([], { level: 'personal' });
    expect(pulse.score).toBeNull();
    expect(pulse.insights[0]?.id).toBe('empty');
    expect(pulse.askPrompt).toContain('this person');
  });

  it('names score drift and a returning topic', () => {
    const pulse = buildWellbeingInsights(
      [
        moment({
          id: 'new',
          score: 70,
          createdAt: '2026-08-25T13:00:00.000Z',
          topics: ['work'],
          mode: 'standard',
          category: 'emotion',
        }),
        moment({
          id: 'old',
          score: 50,
          createdAt: '2026-08-25T11:00:00.000Z',
          topics: ['work'],
          mode: 'idg',
        }),
      ],
      { level: 'space' },
    );
    expect(pulse.score).toBe(60);
    expect(pulse.trend.direction).toBe('up');
    expect(pulse.topTopic).toBe('work');
    expect(pulse.insights.map((item) => item.id)).toContain('driftUp');
    expect(pulse.insights.map((item) => item.id)).toContain('topicFocus');
  });

  it('surfaces a spoken NVC need', () => {
    const pulse = buildWellbeingInsights(
      [
        moment({
          score: 44,
          mode: 'nvc',
          nvc: { need: 'quiet so I can think' },
        }),
      ],
      { level: 'personal' },
    );
    expect(pulse.topNeed).toBe('quiet so I can think');
    expect(pulse.insights.map((item) => item.id)).toContain('nvcNeed');
  });
});
