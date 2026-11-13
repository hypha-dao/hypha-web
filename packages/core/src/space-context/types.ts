import type {
  SpaceContextPendingChange,
  SpaceContextSectionKey,
  SpaceContextStatus,
} from './constants';

export type SpaceContextSectionRecord = {
  id: number;
  spaceId: number;
  sectionKey: SpaceContextSectionKey;
  /** Display title: the built-in heading or the title members gave it. */
  title: string;
  isCustom: boolean;
  /** Working draft members and the section agent edit. Never official by itself. */
  markdown: string;
  /** Text as last ratified through Agreements; null until the first ratification. */
  ratifiedMarkdown: string | null;
  /** The working draft differs from the ratified text. */
  hasDraftChanges: boolean;
  pendingChange: SpaceContextPendingChange | null;
  status: SpaceContextStatus;
  version: number;
  proposalDocumentId: number | null;
  ratifiedDocumentId: number | null;
  ratifiedAt: string | null;
  chatRoomId: string | null;
  updatedByPersonId: number | null;
  createdAt: string;
  updatedAt: string;
  proposalTitle: string | null;
  proposalSlug: string | null;
  proposalWeb3Id: number | null;
  proposalStatus: 'accepted' | 'rejected' | 'onVoting' | null;
  ratifiedTitle: string | null;
  ratifiedSlug: string | null;
  ratifiedWeb3Id: number | null;
  contributorCount: number;
  lastEditorName: string | null;
};

export type SpaceContextMessageRecord = {
  id: number;
  sectionId: number;
  personId: number | null;
  personName: string | null;
  agentKey: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

export type SpaceContextAgentMemoryRecord = {
  spaceId: number;
  sectionKey: SpaceContextSectionKey;
  agentKey: string;
  memoryMarkdown: string;
  updatedAt: string;
};

export type SpaceContextRemovedSection = {
  sectionKey: SpaceContextSectionKey;
  title: string;
  removedAt: string | null;
};

export type SpaceContextOverview = {
  spaceSlug: string;
  spaceTitle: string;
  /** Official sections plus suggested additions (`pendingChange: 'add'`). */
  sections: SpaceContextSectionRecord[];
  /** Sections removed by a passed proposal; members can suggest restoring them. */
  removedSections: SpaceContextRemovedSection[];
  ratifiedCount: number;
  /** Official sections only; suggested additions do not count. */
  totalCount: number;
};

export type SpaceContextSectionDetail = {
  section: SpaceContextSectionRecord;
  messages: SpaceContextMessageRecord[];
  specialistMemory: SpaceContextAgentMemoryRecord | null;
};
