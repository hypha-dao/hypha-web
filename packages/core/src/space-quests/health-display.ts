import { parseQuestCalendarDate } from './calendar-date';
import type { QuestHealthState, QuestStatus } from './constants';

export type QuestHealthDisplay = {
  /** Proposed quests have not started execution. */
  notStarted: boolean;
  label: string;
  /** 0 is the start of the health bar. */
  marker: number;
  summary: string | null;
  state: QuestHealthState | null;
};

const VOTING_HEALTH_COPY = /quest proposal submitted for voting/i;

/** Stored health for a quest that has not started. Execution marker stays at 0. */
export const NEW_QUEST_HEALTH_RECORD = {
  healthState: 'on_track' as const,
  healthMarker: 0,
  healthSummary: '',
};

/** Words computeQuestHealth can produce. Active cards and detail use these only. */
export const ACTIVE_QUEST_HEALTH_LABEL = {
  on_track: 'On track',
  off_track: 'Off track',
} as const;

const STATE_LABEL: Record<QuestHealthState, string> = {
  on_track: ACTIVE_QUEST_HEALTH_LABEL.on_track,
  at_risk: 'At risk',
  off_track: ACTIVE_QUEST_HEALTH_LABEL.off_track,
};

/** Green side of the existing health bar. Not the start position. */
export const QUEST_ON_TRACK_MARKER = 80;
/** Red side of the existing health bar. */
export const QUEST_OFF_TRACK_MARKER = 15;

export type QuestHealthEstimate = {
  state: 'on_track' | 'off_track';
  marker: number;
};

type QuestHealthInput = {
  status?: string | null;
  targetDate?: string | null;
  milestones?: ReadonlyArray<{
    status?: string | null;
    dueDate?: string | null;
  }>;
};

function calendarStamp(year: number, month: number, day: number): number {
  return year * 10_000 + month * 100 + day;
}

function todayStamp(now: Date): number {
  return calendarStamp(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function dateStamp(value: string | null | undefined): number | null {
  const parsed = parseQuestCalendarDate(value);
  if (!parsed) return null;
  return calendarStamp(parsed.year, parsed.month, parsed.day);
}

/**
 * Active-quest health. Off track when an incomplete milestone is undated or
 * late, or when the quest target date is already past. Completed milestones
 * are ignored. A missing quest target date is judged from milestones only.
 * Replace this function when an AI estimate takes over the same result.
 */
export function computeQuestHealth(
  quest: QuestHealthInput,
  now: Date = new Date(),
): QuestHealthEstimate {
  const today = todayStamp(now);
  const incomplete = (quest.milestones ?? []).filter(
    (milestone) => milestone.status !== 'done',
  );
  const milestoneOffTrack = incomplete.some((milestone) => {
    const due = dateStamp(milestone.dueDate);
    return due == null || due < today;
  });
  const questDue = dateStamp(quest.targetDate);
  const questOffTrack =
    quest.status !== 'completed' && questDue != null && questDue < today;
  const offTrack = milestoneOffTrack || questOffTrack;
  return offTrack
    ? { state: 'off_track', marker: QUEST_OFF_TRACK_MARKER }
    : { state: 'on_track', marker: QUEST_ON_TRACK_MARKER };
}

/**
 * Proposed quests sit at the start of the bar and read "Not started".
 * Active quests use computeQuestHealth. Paused, completed, and archived
 * quests keep their stored health.
 */
export function questHealthDisplay(
  quest: {
    status: QuestStatus;
    targetDate?: string | null;
    milestones?: QuestHealthInput['milestones'];
    health: {
      state: QuestHealthState;
      marker: number;
      summary?: string | null;
    };
  },
  now: Date = new Date(),
): QuestHealthDisplay {
  if (quest.status === 'proposed') {
    return {
      notStarted: true,
      label: 'Not started',
      marker: 0,
      summary: null,
      state: null,
    };
  }
  if (quest.status === 'active') {
    const estimate = computeQuestHealth(quest, now);
    return {
      notStarted: false,
      label: STATE_LABEL[estimate.state],
      marker: estimate.marker,
      summary: null,
      state: estimate.state,
    };
  }
  const marker = Number.isFinite(quest.health.marker)
    ? Math.max(0, Math.min(100, quest.health.marker))
    : 0;
  const summary = quest.health.summary?.trim() ?? '';
  return {
    notStarted: false,
    label: STATE_LABEL[quest.health.state],
    marker,
    summary:
      summary.length > 0 && !VOTING_HEALTH_COPY.test(summary) ? summary : null,
    state: quest.health.state,
  };
}
