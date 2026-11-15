import { ProposalOverlay } from './proposal-overlay';

/**
 * Server entry for the client overlay: a `'use client'` file as the page itself
 * inside a route group with parallel routes did not get its client-reference
 * manifest in the production build.
 */
export default function Page() {
  return <ProposalOverlay />;
}
