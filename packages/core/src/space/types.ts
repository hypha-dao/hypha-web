import { Category, SpaceFlags } from '@hypha-platform/core/client';
import { Document } from '@hypha-platform/core/client';
import { Person } from '@hypha-platform/core/client';

export interface Space {
  id: number;
  logoUrl?: string | null;
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
  memberAddresses?: `0x${string}`[];
  documentCount?: number;
  documents?: Document[];
  address?: string | null;
  flags: SpaceFlags[];
  parent?: Space | null;
  organisationSpaces?: Space[];
}

export interface CreateSpaceInput {
  title: string;
  description: string;
  logoUrl?: string;
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
  logoUrl?: string;
  leadImage?: string;
  slug?: string;
  parentId?: number | null;
  web3SpaceId?: number;
  address?: string;
  flags?: SpaceFlags[];
}

export type UpdateSpaceBySlugInput = { slug: string } & UpdateSpaceInput;

export interface SpaceListOptions {
  page?: number;
  pageSize?: number;
  sort?: {
    field: keyof Space;
    direction: 'asc' | 'desc';
  };
}

export type DeleteSpaceBySlugInput = { slug: string };
