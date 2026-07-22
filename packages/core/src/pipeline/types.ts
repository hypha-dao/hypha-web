import type {
  DealPriority,
  DealStatus,
  PipelineStatus,
  PipelineSwimlane,
  Region,
} from './constants';

export type DealContact = {
  firstName?: string;
  lastName?: string;
  role?: string;
  dept?: string;
  email?: string;
  mobile?: string;
  linkedin?: string;
  isPrimary?: boolean;
  contactType?: string;
};

export interface Deal {
  id: number;
  spaceId: number;
  ownerId: number;
  title: string;
  pipelineSwimlane: PipelineSwimlane;
  pipelineStatus: PipelineStatus;
  status: DealStatus;
  priority: DealPriority;
  value: number;
  currency: string;
  country: string | null;
  region: Region;
  contacts: DealContact[];
  contactPerson: string | null;
  contactEmail: string | null;
  linkedinUrl: string | null;
  contactUrl: string | null;
  teamMemberIds: number[];
  accountManagerId: number | null;
  /**
   * Per-deal success-rate override (0–100). When null the stage default
   * from the space's probability matrix applies.
   */
  successRate: number | null;
  nextAction: string | null;
  nextActionDate: string | null;
  notes: string | null;
  tags: string[];
  blocked: boolean;
  blockerReason: string | null;
  submissionDeadline: string | null;
  fundingRateSme: number | null;
  maxProjectSize: number | null;
  expectedPartners: string | null;
  isConsortiumLead: boolean | null;
  eligibleCountries: string[];
  callReference: string | null;
  programme: string | null;
  eligibilityNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDealInput {
  spaceId: number;
  ownerId: number;
  title: string;
  pipelineSwimlane: PipelineSwimlane;
  pipelineStatus: PipelineStatus;
  status?: DealStatus;
  priority?: DealPriority;
  value?: number;
  currency?: string;
  country?: string | null;
  region?: Region;
  contacts?: DealContact[];
  contactPerson?: string | null;
  contactEmail?: string | null;
  linkedinUrl?: string | null;
  contactUrl?: string | null;
  teamMemberIds?: number[];
  accountManagerId?: number | null;
  successRate?: number | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
  notes?: string | null;
  tags?: string[];
  blocked?: boolean;
  blockerReason?: string | null;
  submissionDeadline?: string | null;
  fundingRateSme?: number | null;
  maxProjectSize?: number | null;
  expectedPartners?: string | null;
  isConsortiumLead?: boolean | null;
  eligibleCountries?: string[];
  callReference?: string | null;
  programme?: string | null;
  eligibilityNotes?: string | null;
}

export type UpdateDealInput = Partial<
  Omit<CreateDealInput, 'spaceId' | 'ownerId'>
> & {
  ownerId?: number;
};

export interface DealFilters {
  q?: string;
  swimlane?: PipelineSwimlane | PipelineSwimlane[];
  region?: Region | Region[];
  country?: string | string[];
  priority?: DealPriority | DealPriority[];
  status?: DealStatus | DealStatus[];
  pipelineStatus?: PipelineStatus | PipelineStatus[];
  ownerId?: number;
  tag?: string;
  hasDeadline?: boolean;
}

export interface PipelineSavedViewRecord {
  id: number;
  spaceId: number;
  personId: number;
  name: string;
  filters: Record<string, unknown>;
  sort: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePipelineSavedViewInput {
  spaceId: number;
  personId: number;
  name: string;
  filters?: Record<string, unknown>;
  sort?: Record<string, unknown>;
}

export interface UpdatePipelineSavedViewInput {
  name?: string;
  filters?: Record<string, unknown>;
  sort?: Record<string, unknown>;
}

export interface PipelineUserSettingsRecord {
  id: number;
  spaceId: number;
  personId: number;
  countryFocus: string[];
  createdAt: Date;
  updatedAt: Date;
}
