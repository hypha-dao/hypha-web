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

const STATE_LABEL: Record<QuestHealthState, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
};

/**
 * Proposed quests sit at the start of the bar and read "Not started".
 * Active, paused, completed, and archived quests keep their stored health.
 */
export function questHealthDisplay(quest: {
  status: QuestStatus;
  health: {
    state: QuestHealthState;
    marker: number;
    summary?: string | null;
  };
}): QuestHealthDisplay {
  if (quest.status === 'proposed') {
    return {
      notStarted: true,
      label: 'Not started',
      marker: 0,
      summary: null,
      state: null,
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
