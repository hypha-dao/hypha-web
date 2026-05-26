'use client';

import { useTranslations } from 'next-intl';

import {
  type AiCompetencyAgent,
  tagGroupAccentClass,
} from '../ai-agent-competencies';
import { cn } from '@hypha-platform/ui-utils';

type AiPanelMobilizedAgentsProps = {
  agents: readonly AiCompetencyAgent[];
  isStreaming?: boolean;
};

export function AiPanelMobilizedAgents({
  agents,
  isStreaming = false,
}: AiPanelMobilizedAgentsProps) {
  const t = useTranslations('AiPanel');
  const tCoherence = useTranslations('CoherenceTab');

  if (agents.length === 0) return null;

  return (
    <div
      className="mb-2 flex flex-col gap-1.5"
      data-testid="ai-panel-mobilized-agents"
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {isStreaming
          ? t('specialistsRespondingStreaming')
          : t('specialistsResponding')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {agents.map((agent) => (
          <span
            key={agent.id}
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight',
              tagGroupAccentClass(agent.tagGroup),
            )}
          >
            <span aria-hidden="true" className="font-semibold">
              {agent.avatarLabel}
            </span>
            <span className="truncate">{tCoherence(agent.role)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
