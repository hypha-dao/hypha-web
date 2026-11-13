import { ApproveActionPage } from './_components/approve-action-page';

type PageProps = {
  params: Promise<{ actionId: string }>;
};

const DEFAULT_CLOSE_SECONDS = 5;
const MAX_CLOSE_SECONDS = 60;

/**
 * Seconds the page waits after a confirmed or cancelled request before it
 * closes its window; `0` turns the countdown off. Read on the server so the
 * value can change without a rebuild.
 */
function readCloseSeconds(): number {
  const raw = process.env.INTEGRATION_APPROVAL_CLOSE_SECONDS?.trim();
  if (!raw) return DEFAULT_CLOSE_SECONDS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_CLOSE_SECONDS;
  return Math.min(Math.floor(value), MAX_CLOSE_SECONDS);
}

/**
 * Approval page (spike, #2515 milestone 04b). Opened from an integration
 * client as a popup or a redirect; it cannot be framed (CSP `frame-ancestors`).
 * It lives in the `(popup)` route group, which has its own minimal layout.
 * The Privy login is checked in the page and again by every API call it makes.
 */
export default async function Page(props: PageProps) {
  const { actionId } = await props.params;
  return (
    <ApproveActionPage
      actionId={actionId}
      closeAfterSeconds={readCloseSeconds()}
    />
  );
}
