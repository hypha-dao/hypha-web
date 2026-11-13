import {
  StaleDeploymentError,
  isStaleClientBundleError,
  type StaleAgreementRef,
} from '@hypha-platform/core/client';

export const STALE_DEPLOYMENT_MESSAGE =
  'A new version of Hypha was deployed. Reload to continue. Your draft is kept.';

export type QuestPublishFailurePlan =
  | {
      kind: 'stale';
      /** Quest row from this attempt, when no agreement was created for it. */
      deleteQuestSlug: string | null;
      /** Web2 agreement that already ran. A retry must reuse it. */
      keepAgreement: StaleAgreementRef | null;
    }
  | { kind: 'other' };

/**
 * A stale bundle must not create a second agreement. When the Web2 step
 * already returned an id, keep that row and the quest. When it did not,
 * drop the quest created earlier in the same attempt.
 */
export function questPublishFailurePlan(
  error: unknown,
  createdQuestSlug: string | null,
): QuestPublishFailurePlan {
  if (!isStaleClientBundleError(error)) return { kind: 'other' };
  const keepAgreement =
    error instanceof StaleDeploymentError ? error.agreement : null;
  return {
    kind: 'stale',
    deleteQuestSlug: keepAgreement ? null : createdQuestSlug,
    keepAgreement,
  };
}
