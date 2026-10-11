export type NetworkSignalKind = 'Need' | 'Action' | 'Impact';

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

export type NetworkExchangeSpace = {
  id: number;
  slug: string;
  title: string;
  description: string;
  place: string;
  chatRoomId: string | null;
  seeks: string[];
  offers: string[];
};
