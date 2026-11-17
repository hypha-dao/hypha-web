import { requireCreateAction } from '@web/lib/white-label/require-create-action';
import { SelectCreateOverlay } from './select-create-overlay';

/**
 * The create menu over Agreements: only the proposal types the client enabled.
 * Served on a host with login only (see `requireCreateAction`).
 */
export default async function Page() {
  await requireCreateAction('agreement', 'contribution');
  return <SelectCreateOverlay />;
}
