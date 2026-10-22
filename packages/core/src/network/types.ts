export type NetworkSignalKind = 'Need' | 'Action' | 'Impact';

export type NetworkOpenNeedKind = 'Need' | 'Risk' | 'Tension';

/** All eight space signal types that can be shared on the network exchange. */
export const NETWORK_FIELD_KINDS = [
  'Need',
  'Resource',
  'Opportunity',
  'Insight',
  'Tension',
  'Risk',
  'Action',
  'Impact',
] as const;

export type NetworkFieldSignalKind = (typeof NETWORK_FIELD_KINDS)[number];

export type NetworkFieldPayout = {
  amount: string;
  token: string;
};

export type NetworkFieldSignal = {
  slug: string;
  title: string;
  description: string;
  type: NetworkFieldSignalKind;
  spaceSlug: string;
  spaceTitle: string;
  place: string;
  creatorName: string | null;
  spaceChatRoomId: string | null;
  leadImage: string | null;
  /** Lead image, then every image attachment, without duplicates. */
  images: { url: string; name: string }[];
  videoUrl: string | null;
  /** Non-image attachments, in the order they were shared. */
  documents: { url: string; name: string }[];
  /** First document. Kept so a card can show one file without opening the list. */
  document: { url: string; name: string } | null;
  updatedAt: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dueAt: string | null;
  /** Stored form of capital, else the first capital in tags, else the first capital the space seeks. */
  capital: string | null;
  payouts: NetworkFieldPayout[];
  spaceDescription: string;
  spaceLeadImage: string | null;
  spaceSeeks: string[];
  spaceOffers: string[];
};

export type NetworkSharedSignal = {
  slug: string;
  title: string;
  description: string;
  type: NetworkSignalKind;
  spaceSlug: string;
  spaceTitle: string;
  spaceChatRoomId: string | null;
  leadImage: string | null;
};

export type NetworkSpaceRank = {
  spaceId: number;
  spaceSlug: string;
  spaceTitle: string;
  place: string;
  chatRoomId: string | null;
  need: number;
  action: number;
  impact: number;
};

export type NetworkOpenNeed = {
  slug: string;
  title: string;
  description: string;
  type: NetworkOpenNeedKind;
  spaceSlug: string;
  spaceTitle: string;
  spaceChatRoomId: string | null;
  leadImage: string | null;
  updatedAt: string | null;
  /** Stored form of capital, else the first capital in tags, else the first capital the space seeks. */
  capital: string | null;
  actionCount: number;
  impactCount: number;
  spacePlace: string;
  spaceDescription: string;
  spaceLeadImage: string | null;
  spaceSeeks: string[];
  spaceOffers: string[];
};

export type NetworkExchangeSpace = {
  id: number;
  slug: string;
  title: string;
  description: string;
  place: string;
  chatRoomId: string | null;
  leadImage: string | null;
  latitude: number | null;
  longitude: number | null;
  categories: string[];
  seeks: string[];
  offers: string[];
};
