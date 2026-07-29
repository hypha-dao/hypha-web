export type EcosystemMemberKind = 'person' | 'space';

export type EcosystemMemberPreview = {
  id: string;
  kind: EcosystemMemberKind;
  label: string;
  imageUrl?: string | null;
  slug?: string;
};

export type MyceliumNodeKind = 'space' | 'person' | 'hub' | 'external';

export type MyceliumNode = {
  id: string;
  kind: MyceliumNodeKind;
  label: string;
  imageUrl?: string | null;
  slug?: string;
  meta?: string;
  expandable?: boolean;
  expanded?: boolean;
  /** Fixed position hints for force layout */
  fx?: number | null;
  fy?: number | null;
};

export type MyceliumLink = {
  id: string;
  source: string;
  target: string;
  strength?: number;
  /** Relative visual weight 0–1 for stroke thickness (e.g. cumulative amount). */
  weight?: number;
  label?: string;
  meta?: string;
};

export type MyceliumGraph = {
  nodes: MyceliumNode[];
  links: MyceliumLink[];
};

export type HierarchyNode = {
  name: string;
  logoUrl?: string | null;
  id: number;
  slug?: string;
  value?: number;
  children?: HierarchyNode[];
};
