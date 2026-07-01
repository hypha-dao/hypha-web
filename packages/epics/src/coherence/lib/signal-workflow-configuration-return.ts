import type { Locale } from '@hypha-platform/i18n';

/** Query param marking space configuration opened from the signals workflow cog. */
export const SIGNAL_WORKFLOW_FROM_PARAM = 'from';
export const SIGNAL_WORKFLOW_FROM_VALUE = 'signal-workflow';

function mergeSignalWorkflowReturnSearchParams(
  searchParams: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  params.delete(SIGNAL_WORKFLOW_FROM_PARAM);
  return params;
}

export function buildSignalWorkflowConfigurationPath(
  lang: Locale,
  spaceSlug: string,
  returnSearchParams?: Pick<URLSearchParams, 'toString'>,
): string {
  const params = mergeSignalWorkflowReturnSearchParams(
    new URLSearchParams(returnSearchParams?.toString() ?? ''),
  );
  params.set(SIGNAL_WORKFLOW_FROM_PARAM, SIGNAL_WORKFLOW_FROM_VALUE);
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
  searchParams?: Pick<URLSearchParams, 'toString'>,
): string {
  const params = mergeSignalWorkflowReturnSearchParams(
    new URLSearchParams(searchParams?.toString() ?? ''),
  );
  const qs = params.toString();
  return qs
    ? `/${lang}/dho/${spaceSlug}/coherence?${qs}`
    : `/${lang}/dho/${spaceSlug}/coherence`;
}
