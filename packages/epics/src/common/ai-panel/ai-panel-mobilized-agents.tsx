'use client';

import { useTranslations } from 'next-intl';

import { type AiCompetencyAgent } from '../ai-agent-competencies';

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
            className="inline-flex max-w-full items-center rounded-full border border-accent-8/70 bg-background px-2.5 py-0.5 text-[10px] font-medium leading-tight text-foreground shadow-sm"
          >
            <span className="truncate">{tCoherence(agent.role)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
