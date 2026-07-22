export const SIGNAL_RECENCY_BUCKET_COUNT = 6;

export type SignalRecencyExtent = {
  recentTs: number;
  oldestTs: number;
  recencySpan: number;
};

export function computeSignalRecencyExtent(
  signals: Array<{ createdAt: string | Date | null | undefined }>,
): SignalRecencyExtent | null {
  const timestamps = signals
    .map((signal) => new Date(signal.createdAt ?? '').getTime())
    .filter((timestamp) => Number.isFinite(timestamp));

  if (timestamps.length === 0) {
    return null;
  }

  const recentTs = Math.max(...timestamps);
  const oldestTs = Math.min(...timestamps);

  return {
    recentTs,
    oldestTs,
    recencySpan: Math.max(1, recentTs - oldestTs),
  };
}

export function getSignalRecencyBucketIndex(
  createdAt: string | Date | null | undefined,
  extent: SignalRecencyExtent,
  bucketCount = SIGNAL_RECENCY_BUCKET_COUNT,
): number | null {
  const timestamp = new Date(createdAt ?? '').getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const ageRatio = (extent.recentTs - timestamp) / extent.recencySpan;
  return Math.max(
    0,
    Math.min(bucketCount - 1, Math.floor(ageRatio * bucketCount)),
  );
}

export function parseSignalRecencyBucketParam(
  raw: string | null | undefined,
  bucketCount = SIGNAL_RECENCY_BUCKET_COUNT,
): number | null {
  if (raw == null || raw.trim() === '') {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= bucketCount) {
    return null;
  }
  return parsed;
}
