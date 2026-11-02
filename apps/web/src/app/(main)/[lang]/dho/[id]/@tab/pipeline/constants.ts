import { Locale } from '@hypha-platform/i18n';
import type { PipelineSwimlane } from '@hypha-platform/core/client';

export const getDhoPathPipeline = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/pipeline`;
};

export const getDhoPathPipelineTrack = (
  lang: Locale,
  id: string,
  swimlane: PipelineSwimlane,
) => {
  return `/${lang}/dho/${id}/pipeline/track/${encodeURIComponent(swimlane)}`;
};

export const getDhoPathPipelineDeal = (
  lang: Locale,
  id: string,
  dealId: number,
) => {
  return `/${lang}/dho/${id}/pipeline/deal/${dealId}`;
};

export const getDhoPathPipelineNewDeal = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/pipeline/new-deal`;
};
