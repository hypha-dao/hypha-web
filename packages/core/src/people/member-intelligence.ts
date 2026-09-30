import type { MemberOrientation } from './member-intelligence-guidance';

export type MemberAttentionItem = {
  id: string;
  kind: 'proposal' | 'signal';
  title: string;
  detail: string;
  spaceSlug: string;
  spaceTitle: string;
  targetSlug: string;
};

export type MemberIntelligence = {
  person: {
    id: number;
    slug: string;
    name: string | null;
    surname: string | null;
    nickname: string | null;
    avatarUrl: string | null;
    description: string | null;
    address: string | null;
    preferredCurrency: string | null;
    primaryOrientation: MemberOrientation | null;
  };
  counts: {
    spaces: number;
    openProposals: number;
    signals: number;
    connections: number;
    notifications: number;
    capitalAsks: number;
  };
  guidance: {
    narrative: string;
  };
  attention: MemberAttentionItem[];
  spaces: Array<{
    id: number;
    slug: string;
    title: string;
    description: string;
    logoUrl: string | null;
  }>;
  proposals: Array<{
    id: number;
    slug: string | null;
    title: string;
    state: string | null;
    label: string | null;
    spaceSlug: string;
    spaceTitle: string;
    createdAt: string;
    authoredByMember: boolean;
  }>;
  signals: Array<{
    id: number;
    slug: string | null;
    title: string;
    type: string;
    priority: string | null;
    spaceSlug: string;
    spaceTitle: string;
    assignedToMember: boolean;
  }>;
  notifications: MemberAttentionItem[];
  connections: Array<{
    id: number;
    slug: string | null;
    name: string | null;
    surname: string | null;
    nickname: string | null;
    avatarUrl: string | null;
    sharedSpaceCount: number;
  }>;
  wallet: {
    address: string | null;
    preferredCurrency: string | null;
  };
  chatSpaceSlug: string | null;
};

export type NetworkCapitalAsk = {
  id: number;
  slug: string | null;
  title: string;
  excerpt: string;
  state: string | null;
  spaceSlug: string;
  spaceTitle: string;
  createdAt: string;
};
