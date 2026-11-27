import type { Caller } from '../access/caller';
import type { Origin } from '../origin';

/**
 * Who a data read or write is for when no person is known: a fixed name for a part of the
 * platform (the identity lookup, a job). Never a person and never a client.
 */
export type ServiceActor = { kind: 'service'; name: string };

/**
 * What the one resolver needs to pick a connection: who is acting and, later, in which
 * namespace (#2565). It carries no database handle.
 */
export type DataRequest = {
  actor: Caller | ServiceActor;
  namespace?: string;
};

/** What a read feature and the access layer receive: the person and, later, a namespace. */
export type ReadCtx = {
  actor: Caller;
  namespace?: string;
};

/**
 * What a write feature receives: the person, and the origin the edge built for the path the
 * write came through. The feature checks that the origin matches the actor.
 */
export type WriteCtx = {
  actor: Caller;
  origin: Origin;
  namespace?: string;
};
