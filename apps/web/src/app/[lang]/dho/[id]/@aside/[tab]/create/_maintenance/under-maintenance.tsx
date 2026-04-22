import { Wrench } from 'lucide-react';

/**
 * Temporary "under maintenance" notice for token creation and update proposals.
 *
 * NOTE FOR REMOVAL (next PR after contract changes ship):
 *   1. Delete this entire `_maintenance/` folder.
 *   2. Remove the `// >>> MAINTENANCE START` ... `// <<< MAINTENANCE END`
 *      blocks from:
 *        - issue-new-token/page.tsx
 *        - update-issued-token/page.tsx
 *
 * Approximate duration (informational only): 3 hours from deploy.
 */

/**
 * Typed as `boolean` (not the literal `true`) on purpose: keeps the rest of the
 * page bodies reachable for TypeScript control-flow analysis so the existing
 * `notFound()` narrowing on `spaceFromDb` still works while this flag is on.
 */
export const TOKEN_PROPOSAL_MAINTENANCE: boolean = true;

export function UnderMaintenance({
  title = 'Temporarily under maintenance',
  message = 'Token creation and update proposals are temporarily disabled while we ship a contract change. Expected back online in approximately 3 hours.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="rounded-full bg-warning-3 p-3 text-warning-11">
        <Wrench className="size-7" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-3 font-medium text-neutral-12">{title}</h2>
        <p className="text-2 text-neutral-11">{message}</p>
      </div>
    </div>
  );
}
