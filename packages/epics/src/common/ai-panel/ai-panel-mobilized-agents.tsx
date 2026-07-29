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
 * Mentions-dense expertise header for assistant replies — role labels from the
 * competency catalog (no invented names). Sits next to the avatar, above the bubble.
 */
export function AiPanelMobilizedAgents({
  agents,
  isStreaming = false,
}: AiPanelMobilizedAgentsProps) {
  const t = useTranslations('AiPanel');
  const tCoherence = useTranslations('CoherenceTab');

  if (agents.length === 0) return null;

  return (
    <div
      className="flex min-w-0 flex-col gap-0.5"
      data-testid="ai-panel-mobilized-agents"
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/60">
        {isStreaming
          ? t('specialistsRespondingStreaming')
          : t('specialistsResponding')}
      </span>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        {agents.map((agent, index) => (
          <Fragment key={agent.id}>
            {index > 0 ? (
              <span className="text-[11px] text-foreground/40" aria-hidden>
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
      </div>
    </div>
  );
}
