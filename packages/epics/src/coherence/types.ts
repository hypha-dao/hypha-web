import { Person } from '@hypha-platform/core/client';

export type CoherenceType = 'signal' | 'conversation';

export type LabelType = 'opportunity' | 'tensions';

export type Coherence = {
  id: number;
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
