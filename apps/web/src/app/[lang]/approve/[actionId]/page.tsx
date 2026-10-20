import { ApproveActionPage } from './_components/approve-action-page';

type PageProps = {
  params: Promise<{ actionId: string }>;
};

/**
 * Approval page (spike, #2515 milestone 04b). Opened from an integration
 * client as a popup or a redirect; it cannot be framed (CSP `frame-ancestors`).
 * The Privy login is checked in the page and again by every API call it makes.
 */
export default async function Page(props: PageProps) {
  const { actionId } = await props.params;
  return <ApproveActionPage actionId={actionId} />;
}
