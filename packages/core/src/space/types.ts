export interface Space {
  id: number;
  logoUrl?: string | null;
  leadImage?: string | null;
  title: string;
  description: string | null;
  slug: string;
  parentId?: number | null;
}

export interface CreateSpaceInput {
  title: string;
  description: string;
  logoUrl?: string;
  leadImage?: string;
  slug?: string;
  parentId?: number;
}

export interface UpdateSpaceInput {
  title?: string;
  description?: string;
  logoUrl?: string;
  leadImage?: string;
  slug?: string;
  parentId?: number;
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
