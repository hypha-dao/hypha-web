import type { Locale } from '@hypha-platform/i18n';

export type SignalPriority = 'critical' | 'high' | 'medium' | 'low';

export type MemoryDrillDownFilter =
  | 'general'
  | 'proposals'
  | 'conversations'
  | 'calls'
  | 'ai-chat';

export function parseSignalPriority(raw: string): SignalPriority | undefined {
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'medium' ||
    normalized === 'low'
  ) {
    return normalized;
  }
  return undefined;
}

export type OverviewDrillDown =
  | {
      screen: 'coherence';
      priority?: SignalPriority;
      recencyBucket?: number;
      status?: string;
    }
  | {
      screen: 'memory';
      filter?: MemoryDrillDownFilter;
    }
  | {
      screen: 'treasury';
    };

export function buildOverviewDrillDownPath(
  lang: Locale,
  spaceSlug: string,
  drillDown: OverviewDrillDown,
): string {
  switch (drillDown.screen) {
    case 'coherence': {
      const params = new URLSearchParams();
      if (drillDown.priority) {
        params.set('priority', drillDown.priority);
      }
      if (drillDown.recencyBucket != null) {
        params.set('recencyBucket', String(drillDown.recencyBucket));
      }
      if (drillDown.status?.trim()) {
        params.set('status', drillDown.status.trim());
      }
      const query = params.toString();
      return `/${lang}/dho/${spaceSlug}/coherence${query ? `?${query}` : ''}`;
    }
    case 'memory': {
      const params = new URLSearchParams();
      if (drillDown.filter && drillDown.filter !== 'general') {
        params.set('filter', drillDown.filter);
      }
      const query = params.toString();
      return `/${lang}/dho/${spaceSlug}/memory${query ? `?${query}` : ''}`;
    }
    case 'treasury':
      return `/${lang}/dho/${spaceSlug}/treasury`;
    default:
      return `/${lang}/dho/${spaceSlug}/overview`;
  }
}
