/**
 * The data-access boundary (#2745). Features and the access layer reach the database only
 * through the area modules here (`spaces`, `organisation`, `people`, `proposals`, `signals`,
 * `quests`); each function resolves its connection with `connectionFor` and calls an existing
 * data function unchanged. Unit tests fake these modules; only integration tests use a real
 * database.
 *
 * An edge that still calls a v1 data function directly gets its connection from `connectionFor`
 * and nowhere else.
 */
export * from './types';
export { connectionFor, type Connection } from './connection';
