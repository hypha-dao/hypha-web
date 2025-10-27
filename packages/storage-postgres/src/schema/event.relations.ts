import { relations } from 'drizzle-orm';
import { events } from './event';

export const eventRelations = relations(events, ({ one }) => ({
  // Relation polymorphism should be implemented at application level
}));
