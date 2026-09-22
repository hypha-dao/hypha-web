import type { ContentBuilder } from './content-builder';
import type { RecipientResolver } from './recipient-resolver';
import type { NotificationEvent } from './types';
import { passThroughStrategy, type NotificationStrategy } from './strategy';

interface EventHandlers<E extends NotificationEvent = NotificationEvent> {
  resolver: RecipientResolver<E>;
  contentBuilder: ContentBuilder<E>;
  /** Defaults to `passThroughStrategy` — the resolver already scoped the recipients. */
  strategy?: NotificationStrategy<E>;
}

const registry = new Map<NotificationEvent['type'], EventHandlers<any>>();

/**
 * Registers the (resolver, strategy, content builder) triple for one event type. Called once,
 * as a module-load side effect, by the module owning that event type (e.g. `events/proposal-
 * created.ts`) — import that module once (from the action / route that can fire the event) to
 * make sure registration has happened before `dispatch()` is called.
 */
export function registerEventHandlers<E extends NotificationEvent>(
  type: E['type'],
  handlers: EventHandlers<E>,
): void {
  registry.set(type, handlers);
}

export function getEventHandlers<E extends NotificationEvent>(
  type: E['type'],
): EventHandlers<E> {
  const handlers = registry.get(type);
  if (!handlers) {
    throw new Error(
      `No notification handlers registered for event type "${type}"`,
    );
  }
  return handlers;
}

export function getStrategy<E extends NotificationEvent>(
  type: E['type'],
): NotificationStrategy<E> {
  return getEventHandlers<E>(type).strategy ?? passThroughStrategy;
}
