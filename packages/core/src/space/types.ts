import { Category } from '@core/categories/types';
import { Document } from '@core/governance';
import { Person } from '@core/people';

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
  documentCount?: number;
  documents?: Document[];
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
}

export interface UpdateSpaceInput {
  title?: string;
  description?: string;
  logoUrl?: string;
  leadImage?: string;
  slug?: string;
  parentId?: number | null;
  web3SpaceId?: number;
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
