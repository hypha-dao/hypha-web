import {
  NVC_FIELDS,
  STANDARD_CATEGORIES,
  WELLBEING_DIMENSIONS,
  averageScore,
  feelingFromScore,
  momentMode,
  trendFromScores,
  type NvcField,
  type StandardCategory,
  type WellbeingDimension,
  type WellbeingInsightLevel,
  type WellbeingMoment,
  type WellbeingMode,
} from './wellbeing-model';

export type InsightTemplateId =
  | 'empty'
  | 'firstMoment'
  | 'driftUp'
  | 'driftDown'
  | 'steady'
  | 'topicFocus'
  | 'dimensionFocus'
  | 'categoryFocus'
  | 'nvcNeed'
  | 'modeMix'
  | 'fractal';

export type WellbeingInsight = {
  id: InsightTemplateId;
  values: Record<string, string | number>;
};

export type WellbeingInsightPulse = {
  feeling: ReturnType<typeof feelingFromScore>;
  score: number | null;
  previousScore: number | null;
  trend: ReturnType<typeof trendFromScores>;
  topTopic: string | null;
  topDimension: WellbeingDimension | null;
  topCategory: StandardCategory | null;
  topNeed: string | null;
  dominantMode: WellbeingMode | null;
  insights: WellbeingInsight[];
  askPrompt: string;
};

function countBy<T extends string>(
  items: T[],
): { key: T; count: number } | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let best: { key: T; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

function nvcNeed(moment: WellbeingMoment): string | null {
  const need = moment.nvc?.need?.trim();
  return need ? need.slice(0, 80) : null;
}

function allTopics(moments: WellbeingMoment[]): string[] {
  return moments.flatMap((moment) => moment.topics ?? []);
}

export function buildAskPrompt(
  level: WellbeingInsightLevel,
  pulse: Omit<WellbeingInsightPulse, 'askPrompt' | 'insights'>,
): string {
  const where =
    level === 'personal'
      ? 'this person'
      : level === 'space'
      ? 'this space'
      : level === 'ecosystem'
      ? 'this ecosystem of nested spaces'
      : 'the wider network';
  const score =
    pulse.score == null ? 'unscored still' : `holding ${pulse.score} of 100`;
  const topic = pulse.topTopic
    ? ` The word that keeps returning is #${pulse.topTopic}.`
    : '';
  const need = pulse.topNeed ? ` A need that was named: ${pulse.topNeed}.` : '';
  return `Sense the pulse of ${where}, ${score}.${topic}${need} Speak as a highly conscious woman who can feel what has not been said yet. Be intimate, grounded, and specific. No marketing. Two to four sentences. Show us what we do not yet see.`;
}

export function buildWellbeingInsights(
  moments: WellbeingMoment[],
  options: {
    level: WellbeingInsightLevel;
    previousScore?: number | null;
  },
): WellbeingInsightPulse {
  const score = averageScore(moments);
  const previousScore =
    options.previousScore === undefined
      ? averageScore(moments.slice(1))
      : options.previousScore;
  const displayScore = score ?? 50;
  const feeling = feelingFromScore(displayScore);
  const trend = trendFromScores(displayScore, previousScore);
  const topTopic = countBy(allTopics(moments))?.key ?? null;
  const topDimension =
    countBy(
      moments
        .filter((moment) => momentMode(moment) === 'idg')
        .map((moment) => moment.dimension),
    )?.key ??
    countBy(moments.map((moment) => moment.dimension))?.key ??
    null;
  const topCategory =
    countBy(
      moments
        .map((moment) => moment.category)
        .filter((value): value is StandardCategory =>
          Boolean(value && STANDARD_CATEGORIES.includes(value)),
        ),
    )?.key ?? null;
  const topNeed =
    moments.map(nvcNeed).find((value): value is string => Boolean(value)) ??
    null;
  const dominantMode = countBy(moments.map(momentMode))?.key ?? null;

  const insights: WellbeingInsight[] = [];

  if (moments.length === 0) {
    insights.push({ id: 'empty', values: { level: options.level } });
  } else if (moments.length === 1) {
    insights.push({
      id: 'firstMoment',
      values: { title: moments[0]?.title ?? '' },
    });
  } else if (trend.direction === 'up') {
    insights.push({ id: 'driftUp', values: { delta: Math.abs(trend.delta) } });
  } else if (trend.direction === 'down') {
    insights.push({
      id: 'driftDown',
      values: { delta: Math.abs(trend.delta) },
    });
  } else {
    insights.push({ id: 'steady', values: { feeling } });
  }

  if (topTopic) {
    insights.push({ id: 'topicFocus', values: { topic: topTopic } });
  }
  if (topDimension && WELLBEING_DIMENSIONS.includes(topDimension)) {
    insights.push({
      id: 'dimensionFocus',
      values: { dimension: topDimension },
    });
  }
  if (topCategory) {
    insights.push({ id: 'categoryFocus', values: { category: topCategory } });
  }
  if (topNeed) {
    insights.push({ id: 'nvcNeed', values: { need: topNeed } });
  }
  if (dominantMode && moments.length > 1) {
    insights.push({ id: 'modeMix', values: { mode: dominantMode } });
  }
  if (moments.length > 0) {
    insights.push({ id: 'fractal', values: { level: options.level } });
  }

  const pulse = {
    feeling,
    score,
    previousScore,
    trend,
    topTopic,
    topDimension,
    topCategory,
    topNeed,
    dominantMode,
    insights: insights.slice(0, 4),
  };

  return {
    ...pulse,
    askPrompt: buildAskPrompt(options.level, pulse),
  };
}

export function insightContextFields(moment: WellbeingMoment): string[] {
  if (momentMode(moment) === 'nvc') {
    return NVC_FIELDS.map((field: NvcField) => moment.nvc?.[field]).filter(
      (value): value is string => Boolean(value?.trim()),
    );
  }
  if (momentMode(moment) === 'standard') {
    return [
      moment.comment,
      moment.experience,
      moment.actionNote,
      moment.emotionNote,
      moment.decisionNote,
      moment.discoveryNote,
    ].filter((value): value is string => Boolean(value?.trim()));
  }
  return [];
}
