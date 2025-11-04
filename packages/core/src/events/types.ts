export const EVENT_ENTITY_TYPES = [
  'person',
  'space',
  'document',
  'token',
] as const;

export type EventEntity = (typeof EVENT_ENTITY_TYPES)[number];

export interface CreateEventInput {
  type: string;
  referenceId: number;
  referenceEntity: EventEntity;
  parameters: object;
}

export interface Event {
  id: number;
  type: string;
  createdAt: Date;
  referenceId: number;
  referenceEntity: EventEntity;
  parameters: any;
}
