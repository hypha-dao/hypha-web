import { ProposalOverlayShell } from '@hypha-platform/epics';

/** Shown while the proposal route loads: an empty overlay, as in the main app. */
export default function Loading() {
  return <ProposalOverlayShell>{null}</ProposalOverlayShell>;
}
