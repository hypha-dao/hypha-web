import { and, eq } from 'drizzle-orm';
import {
  documents,
  type Event,
  EventReference,
  events,
  people,
  spaces,
  tokens,
} from '../schema';

export class EventQueryBuilder {
  static withReference(reference: EventReference) {
    return and(
      eq(events.referenceId, reference.id),
      eq(events.referenceEntity, reference.entity),
    );
  }

  static getReferenceTable(entity: EventReference['entity']) {
    switch (entity) {
      case 'person':
        return people;
      case 'space':
        return spaces;
      case 'document':
        return documents;
      case 'token':
        return tokens;
      default:
        throw new Error(`Unknown entity: ${entity}`);
    }
  }
}

// Type guard helpers
export const isPersonEvent = (event: Event) =>
  event.referenceEntity === 'person';
export const isSpaceEvent = (event: Event) => event.referenceEntity === 'space';
export const isDocumentEvent = (event: Event) =>
  event.referenceEntity === 'document';
export const isTokenEvent = (event: Event) => event.referenceEntity === 'token';
