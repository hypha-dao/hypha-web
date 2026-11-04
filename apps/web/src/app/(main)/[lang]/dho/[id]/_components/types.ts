export type VisibleSpace = {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  parentId?: number | null;
  root: boolean;
};
