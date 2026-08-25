'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useAiPanel } from '../../common/human-chat-panel-context';
import { buildWellbeingInsights } from '../wellbeing-insights';
import type {
  WellbeingInsightLevel,
  WellbeingMoment,
} from '../wellbeing-model';
import '../wellbeing-accents.css';

type WellbeingInsightsCardProps = {
  level: WellbeingInsightLevel;
  moments: WellbeingMoment[];
  previousScore?: number | null;
  className?: string;
};

export function WellbeingInsightsCard({
  level,
  moments,
  previousScore,
  className,
}: WellbeingInsightsCardProps) {
  const t = useTranslations('Wellbeing');
  const { openAiPanel } = useAiPanel();
  const [copied, setCopied] = useState(false);
  const pulse = useMemo(
    () => buildWellbeingInsights(moments, { level, previousScore }),
    [level, moments, previousScore],
  );

  const handleAsk = async () => {
    try {
      await navigator.clipboard.writeText(pulse.askPrompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    openAiPanel();
    window.setTimeout(() => setCopied(false), 2400);
  };

  return (
    <Card className={cn('wb-scope craft-card overflow-hidden', className)}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
            {t('insightsKicker')}
          </p>
          <h3 className="mt-1 [font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em] text-foreground">
            {t(`insightsTitle.${level}`)}
          </h3>
        </div>
        <div className="flex flex-col gap-3">
          {pulse.insights.map((insight) => {
            const values = { ...insight.values };
            if (typeof values.dimension === 'string') {
              values.dimension = t(`dimension.${values.dimension}`);
            }
            if (typeof values.category === 'string') {
              values.category = t(`category.${values.category}`);
            }
            if (typeof values.mode === 'string') {
              values.mode = t(`mode.${values.mode}`);
            }
            if (typeof values.feeling === 'string') {
              values.feeling = t(`feeling.${values.feeling}`);
            }
            if (typeof values.level === 'string') {
              values.level = t(`insightsLevel.${values.level}`);
            }
            return (
              <p
                key={insight.id}
                className="text-2 leading-relaxed text-foreground"
              >
                {t(`insights.${insight.id}`, values)}
              </p>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          className="self-start rounded-xl"
          onClick={() => void handleAsk()}
        >
          {copied ? t('insightsCopied') : t('insightsAskAi')}
        </Button>
      </CardContent>
    </Card>
  );
}
