export interface Space {
  id?: number;
  logoUrl?: string | null;
  leadImage?: string | null;
  title: string;
  description: string | null;
  slug: string;
  parentId?: number | null;
  createdAt: Date;
  owner: string;
}

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
