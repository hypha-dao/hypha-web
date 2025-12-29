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
};
