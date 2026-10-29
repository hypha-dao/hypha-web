import type { SpaceContextSectionKey, SpaceContextStatus } from './constants';

export type SpaceContextSectionRecord = {
  id: number;
  spaceId: number;
  sectionKey: SpaceContextSectionKey;
  markdown: string;
  status: SpaceContextStatus;
  version: number;
  proposalDocumentId: number | null;
  ratifiedDocumentId: number | null;
  ratifiedAt: string | null;
  updatedByPersonId: number | null;
  createdAt: string;
  updatedAt: string;
  proposalTitle: string | null;
  proposalSlug: string | null;
  proposalWeb3Id: number | null;
  proposalStatus: 'accepted' | 'rejected' | 'onVoting' | null;
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

export type SpaceContextOverview = {
  spaceSlug: string;
  spaceTitle: string;
  sections: SpaceContextSectionRecord[];
  ratifiedCount: number;
  totalCount: number;
};

export type SpaceContextSectionDetail = {
  section: SpaceContextSectionRecord;
  messages: SpaceContextMessageRecord[];
  specialistMemory: SpaceContextAgentMemoryRecord | null;
};
