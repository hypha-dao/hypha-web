import type {
  QuestHealthState,
  QuestMilestoneStatus,
  QuestStatus,
  QuestUpdateKind,
} from './constants';

export type QuestReward = {
  amount: string;
  token: string;
};

export type QuestMilestoneRecord = {
  id: number;
  questId: number;
  order: number;
  name: string;
  description: string;
  dueDate: string | null;
  ownerPersonId: number | null;
  ownerName: string | null;
  status: QuestMilestoneStatus;
};

export type QuestMemberRecord = {
  id: number;
  questId: number;
  personId: number | null;
  memberName: string;
  memberAvatarUrl: string | null;
  roleLabel: string | null;
  responsibilities: string[];
  order: number;
  isLead?: boolean;
};

export type QuestDeliverableRecord = {
  id: number;
  questId: number;
  name: string;
  url: string | null;
  note: string | null;
  order: number;
  updatedByPersonId: number | null;
  updatedByName: string | null;
  updatedAt: string;
};

export type QuestUpdateLink = {
  label: string;
  url: string;
  kind?: 'pr' | 'preview' | 'doc' | 'link';
};

export type QuestUpdateChangeItem = {
  label: string;
  format: 'text' | 'short';
  action: 'updated' | 'added' | 'removed' | 'reordered';
  before?: string | null;
  after?: string | null;
};

export type QuestUpdateChange = {
  entity: 'quest' | 'milestone' | 'member' | 'deliverable';
  field: string;
  action: 'updated' | 'added' | 'removed' | 'reordered';
  before?: string | null;
  after?: string | null;
  format?: 'text' | 'short';
  items?: QuestUpdateChangeItem[];
};

export type QuestUpdateRecord = {
  id: number;
  questId: number;
  authorPersonId: number | null;
  authorName: string;
  authorAvatarUrl: string | null;
  kind: QuestUpdateKind;
  /** Always false at ship (MCP out of this PR); agent-shaped rendering ready. */
  viaAgent: boolean;
  milestoneOrder: number | null;
  milestoneLabel: string | null;
  text: string;
  links: QuestUpdateLink[];
  change: QuestUpdateChange | null;
  createdAt: string;
};

/**
 * Quest Health summary — single marker on Off track (0) -> Healthy (100) scale
 * + updated stamp. No Done/Now/Watch Kanban (Hard Rule #9).
 */
export type QuestHealthSummary = {
  state: QuestHealthState;
  marker: number;
  summary: string;
  updatesThisWeek: number;
  lastUpdateAt: string | null;
  generatedAt: string | null;
  daysToTarget: number | null;
};

/**
 * Full Quest record. Note: NO priority field anywhere (Hard Rule #4).
 */
export type QuestRecord = {
  id: number;
  spaceId: number;
  spaceSlug: string;
  spaceTitle: string;
  slug: string;
  name: string;
  goal: string;
  scopeIn: string[];
  scopeOut: string[];
  scopeInMarkdown: string;
  scopeOutMarkdown: string;
  successCriteria: string;
  rewards: QuestReward[];
  status: QuestStatus;
  targetDate: string | null;
  leadPersonId: number | null;
  leadName: string;
  leadAvatarUrl: string | null;
  creatorPersonId: number | null;
  proposalDocumentId: number | null;
  proposalSlug: string | null;
  /**
   * Matrix room of the linked proposal (`documents.chat_room_id`).
   * Proposed quests discuss there until acceptance creates the quest room.
   */
  proposalChatRoomId?: string | null;
  proposalWeb3Id: number | null;
  proposalStatus: 'accepted' | 'rejected' | 'onVoting' | null;
  acceptedAt: string | null;
  chatRoomId: string | null;
  health: QuestHealthSummary;
  stewardHealthSummaries: boolean;
  memberUpdateAlerts: boolean;
  /** Overview Deliverables card. Rows that already have deliverables stay visible. */
  deliverablesEnabled: boolean;
  milestones: QuestMilestoneRecord[];
  members: QuestMemberRecord[];
  deliverables: QuestDeliverableRecord[];
  updates: QuestUpdateRecord[];
  latestUpdateLine: string | null;
  latestUpdateAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SpaceQuestsOverview = {
  spaceSlug: string;
  spaceTitle: string;
  quests: QuestRecord[];
  counts: {
    active: number;
    proposed: number;
    paused: number;
    completed: number;
    rejected: number;
    archived: number;
    total: number;
  };
};

/** Draft payload used in New Quest + embedded in Quest proposal markdown marker. */
export type QuestDraftInput = {
  name: string;
  goal: string;
  scopeIn: string[];
  scopeOut: string[];
  scopeInMarkdown?: string;
  scopeOutMarkdown?: string;
  successCriteria: string;
  rewards: QuestReward[];
  targetDate: string | null;
  leadPersonId?: number | null;
  leadName: string;
  milestones: Array<{
    name: string;
    description: string;
    dueDate: string | null;
    ownerPersonId?: number | null;
    ownerName: string | null;
    status?: QuestMilestoneStatus;
  }>;
  members: Array<{
    personId?: number | null;
    memberName: string;
    memberAvatarUrl?: string | null;
    roleLabel?: string | null;
    responsibilities: string[];
  }>;
  deliverables?: Array<{
    name: string;
    url?: string | null;
    note?: string | null;
  }>;
};
