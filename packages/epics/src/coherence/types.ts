import { Locale } from '@hypha-platform/i18n';

export type CoherenceType = 'signal' | 'conversation';

export type LabelType = 'opportunity' | 'tensions';

export type ChatCreatorType = {
  avatar?: string;
  name?: string;
  surname?: string;
  type?: 'person' | 'space';
  address?: string;
};

export type Coherence = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  status: CoherenceType;
  label: string;
  labelType: LabelType;
  title: string;
  description: string;
  roomId?: string;
  creatorAddress?: `0x${string}`;
  archived: boolean;
};

export const COHERENCE_ORDERS = [
  'mostviews',
  'mostmessages',
  'mostrecent',
] as const;
export type CoherenceOrder = (typeof COHERENCE_ORDERS)[number];

export type ChatPageParams = {
  id: string;
  lang: Locale;
  chatId: string;
};
