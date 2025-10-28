export type EventEntity = 'person' | 'space' | 'document' | 'token';

export interface CreateEventInput {
  type: string;
  referenceId: number;
  referenceEntity: EventEntity;
  parameters: object;
}
