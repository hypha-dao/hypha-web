'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';

import { type AiCompetencyAgent } from '../ai-agent-competencies';
import { cn } from '@hypha-platform/ui-utils';

type AiPanelMobilizedAgentsProps = {
  agents: readonly AiCompetencyAgent[];
  isStreaming?: boolean;
};

/**
 * Expertise header for assistant replies — role labels from the competency
 * catalog (no invented names). Sits next to the avatar, above the bubble.
 */
const MAX_VISIBLE_MOBILIZED_AGENTS = 3;

export function AiPanelMobilizedAgents({
  agents,
  isStreaming = false,
}: AiPanelMobilizedAgentsProps) {
  const t = useTranslations('AiPanel');
  const tCoherence = useTranslations('CoherenceTab');

  if (agents.length === 0) return null;

  const visibleAgents = agents.slice(0, MAX_VISIBLE_MOBILIZED_AGENTS);
  const extraCount = agents.length - visibleAgents.length;

  return (
    <div
      className="flex min-w-0 flex-col gap-0.5"
      data-testid="ai-panel-mobilized-agents"
    >
      <span className="text-[11px] font-medium text-foreground/60">
        {isStreaming
          ? t('specialistsRespondingStreaming')
          : t('specialistsResponding')}
      </span>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        {visibleAgents.map((agent, index) => (
          <Fragment key={agent.id}>
            {index > 0 ? (
              <span className="text-xs text-foreground/40" aria-hidden>
                ·
              </span>
            ) : null}
            <span
              className={cn(
                'min-w-0 truncate text-xs font-semibold text-foreground',
                isStreaming && 'animate-pulse',
              )}
            >
              {tCoherence(agent.role)}
            </span>
          </Fragment>
        ))}
        {extraCount > 0 ? (
          <span className="text-xs text-foreground/50">
            {t('specialistsMore', { count: extraCount })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
