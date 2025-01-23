import { Space } from '@hypha-platform/model';

export interface CreateSpaceInput {
  title: string;
  description: string;
  logoUrl: string;
  leadImage: string;
  slug: string;
  parentId?: string;
}

export interface UpdateSpaceInput {
  title?: string;
  description?: string;
  logoUrl?: string;
  leadImage?: string;
  slug?: string;
  parentId?: string;
}

export interface SpaceListOptions {
  page?: number;
  pageSize?: number;
  sort?: {
    field: keyof Space;
    direction: 'asc' | 'desc';
  };
}
