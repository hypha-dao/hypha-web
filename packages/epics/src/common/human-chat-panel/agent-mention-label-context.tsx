'use client';

import { createContext, useContext } from 'react';
import { useTranslations } from 'next-intl';

const AgentMentionLabelContext = createContext<string | null>(null);

/** Overrides the generic agent label for surfaces with a named agent (e.g. Space Context specialists). */
export const AgentMentionLabelProvider = AgentMentionLabelContext.Provider;

export function useAgentMentionLabel(): string {
  const override = useContext(AgentMentionLabelContext);
  const t = useTranslations('HumanChatPanel');
  return override?.trim() || t('agentMentionLabel');
}
