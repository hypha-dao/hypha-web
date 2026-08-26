'use client';

import { useEffect, useState } from 'react';
import {
  readLastActiveSpaceSlug,
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../common/recent-space-history';

export function useRecentSpaceUsage() {
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const [lastActiveSlug, setLastActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setRecentSlugs(readRecentSpaceSlugs());
      setLastActiveSlug(readLastActiveSpaceSlug());
    };
    sync();
    return subscribeRecentSpaceSlugs(sync);
  }, []);

  return { recentSlugs, lastActiveSlug };
}
