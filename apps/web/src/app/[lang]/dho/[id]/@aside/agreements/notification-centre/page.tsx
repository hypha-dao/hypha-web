import AsideNotificationCentrePage from '@web/components/aside-notification-centre-page';

/**
 * Explicit agreements-tab slot so `/dho/[id]/agreements/notification-centre`
 * renders the notification centre in {@link ProposalOverlayShell} (same as
 * `@aside/[tab]/notification-centre` when tab is agreements).
 */
export default function DhoAgreementsNotificationCentrePage() {
  return <AsideNotificationCentrePage />;
}
