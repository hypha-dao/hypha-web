/**
 * `/coherence/new-signal` is a specific route because the signals tab has its
 * own page there. The create form on `@aside/[tab]/new-signal` is a different
 * route, so this slot would otherwise stay empty and the popup would not open.
 */
export { default } from '../../[tab]/new-signal/page';
