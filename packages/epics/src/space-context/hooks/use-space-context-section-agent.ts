'use client';

import {
  specialistForSectionKey,
  type SpaceContextSectionKey,
} from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { MatrixAgentSkill } from '../../common/human-chat-panel/matrix-agent-mention';

const SECTION_AGENT_SKILL_IDS = [
  'review',
  'refine',
  'draft',
  'fromSource',
] as const;

export type SpaceContextSectionAgent = {
  label: string;
  skills: MatrixAgentSkill[];
};

/** The named agent and @ skills for one Context section's discussion. */
export function useSpaceContextSectionAgent(
  sectionKey: SpaceContextSectionKey,
  sectionTitle: string,
): SpaceContextSectionAgent;
export function useSpaceContextSectionAgent(
  sectionKey: SpaceContextSectionKey | null | undefined,
  sectionTitle: string,
): SpaceContextSectionAgent | null;
export function useSpaceContextSectionAgent(
  sectionKey: SpaceContextSectionKey | null | undefined,
  sectionTitle: string,
): SpaceContextSectionAgent | null {
  const t = useTranslations('SpaceContext');
  return useMemo(() => {
    if (!sectionKey) return null;
    return {
      label: specialistForSectionKey(sectionKey).agentName,
      skills: SECTION_AGENT_SKILL_IDS.map((id) => ({
        id,
        prompt: t(`chat.skills.${id}`, { section: sectionTitle }),
      })),
    };
  }, [sectionKey, sectionTitle, t]);
}
