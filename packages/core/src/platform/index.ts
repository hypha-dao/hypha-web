export { isHyphaPlatformSpace } from './is-hypha-platform-space';
export {
  isPlaceholderPayingSpace,
  isPlaceholderSpaceTitle,
  normalizePayingSpaceTitle,
  resolvedPayingSpaceTitle,
} from './is-placeholder-space-title';
export {
  SECONDS_PER_DAY,
  buildPayingSpacesTimeline,
  coverageOverlapsMonth,
  enumerateMonthKeys,
  monthKeyToStartSec,
  nextMonthKey,
  previousMonthKey,
  reconstructCoverage,
  toMonthKey,
} from './paying-spaces-timeline';
export type {
  CoverageInterval,
  PayingSpacesTimeline,
  PayingSpacesTimelineSpaceSeries,
  SpacePaymentEvent,
} from './paying-spaces-timeline';
export type {
  PayingSpaceMonthBucket,
  PayingSpaceMonthSpacePoint,
  PayingSpaceStatus,
  PayingSpacesDashboardData,
} from './types';
