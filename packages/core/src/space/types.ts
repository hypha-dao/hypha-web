import { Category, SpaceFlags } from '@hypha-platform/core/client';
import { Document } from '@hypha-platform/core/client';
import { Person } from '@hypha-platform/core/client';

export interface Space {
  id: number;
  logoUrl?: string | null;
  ecosystemLogoUrlLight?: string | null;
  ecosystemLogoUrlDark?: string | null;
  leadImage?: string | null;
  title: string;
  description: string | null;
  slug: string;
  parentId?: number | null;
  web3SpaceId?: number | null;
  links: string[];
  categories: Category[];
  subspaces?: Space[];
  members?: Person[];
  memberCount?: number;
  /** True when on-chain enrichment failed for this space (distinct from zero counts). */
  onChainDataMissing?: boolean;
  memberAddresses?: `0x${string}`[];
  documentCount?: number;
  documents?: Document[];
  address?: string | null;
  /** Matrix room id for space chat when provisioned. */
  chatRoomId?: string | null;
  flags: SpaceFlags[];
  parent?: Space | null;
  organisationSpaces?: Space[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSpaceInput {
  title: string;
  description: string;
  logoUrl?: string;
  ecosystemLogoUrlLight?: string;
  ecosystemLogoUrlDark?: string;
  leadImage?: string;
  slug?: string;
  parentId?: number | null;
  links?: string[];
  categories?: Category[];
  flags?: SpaceFlags[];
}

export interface UpdateSpaceInput {
  title?: string;
  description?: string;
  logoUrl?: string | null;
  ecosystemLogoUrlLight?: string | null;
  ecosystemLogoUrlDark?: string | null;
  leadImage?: string | null;
  slug?: string;
  parentId?: number | null;
  web3SpaceId?: number;
  address?: string;
  chatRoomId?: string | null;
  flags?: SpaceFlags[];
}

export type UpdateSpaceBySlugInput = { slug: string } & UpdateSpaceInput;

export type UpdateSpaceByIdInput = { id: number } & UpdateSpaceInput;

export interface SpaceListOptions {
  page?: number;
  pageSize?: number;
  sort?: {
    field: keyof Space;
    direction: 'asc' | 'desc';
  };
}

export type DeleteSpaceBySlugInput = { slug: string };
