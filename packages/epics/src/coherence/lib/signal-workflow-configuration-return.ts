import type { Locale } from '@hypha-platform/i18n';

/** Query param marking space configuration opened from the signals workflow cog. */
export const SIGNAL_WORKFLOW_FROM_PARAM = 'from';
export const SIGNAL_WORKFLOW_FROM_VALUE = 'signal-workflow';

export function buildSignalWorkflowConfigurationPath(
  lang: Locale,
  spaceSlug: string,
): string {
  const params = new URLSearchParams({
    [SIGNAL_WORKFLOW_FROM_PARAM]: SIGNAL_WORKFLOW_FROM_VALUE,
  });
  return `/${lang}/dho/${spaceSlug}/coherence/space-configuration?${params.toString()}`;
}

export function isSignalWorkflowConfigurationReturn(
  searchParams: Pick<URLSearchParams, 'get'>,
): boolean {
  return (
    searchParams.get(SIGNAL_WORKFLOW_FROM_PARAM) === SIGNAL_WORKFLOW_FROM_VALUE
  );
}

export function getSignalWorkflowReturnPath(
  lang: Locale,
  spaceSlug: string,
): string {
  return `/${lang}/dho/${spaceSlug}/coherence`;
}
