'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { ArrowRight } from 'lucide-react';
import {
  getDhoPathAgreements,
  getDhoPathEcosystem,
  getDhoPathWellbeing,
} from '../../common/get-path-function';

export type SpaceNextStep = {
  id: 'invite' | 'agree' | 'ecosystem' | 'wellbeing' | 'treasury';
  href: string;
};

export function buildSpaceNextSteps({
  lang,
  spaceSlug,
  memberCount,
  agreementCount,
  wellbeingActivated,
}: {
  lang: Locale;
  spaceSlug: string;
  memberCount: number | null;
  agreementCount: number | null;
  wellbeingActivated: boolean;
}): SpaceNextStep[] {
  const steps: SpaceNextStep[] = [];
  if (memberCount != null && memberCount < 3) {
    steps.push({
      id: 'invite',
      href: `/${lang}/dho/${spaceSlug}/members`,
    });
  }
  if (agreementCount != null && agreementCount < 1) {
    steps.push({
      id: 'agree',
      href: `${getDhoPathAgreements(lang, spaceSlug)}/select-create-action`,
    });
  }
  steps.push({
    id: 'ecosystem',
    href: getDhoPathEcosystem(lang, spaceSlug),
  });
  if (wellbeingActivated) {
    steps.push({
      id: 'wellbeing',
      href: getDhoPathWellbeing(lang, spaceSlug),
    });
  } else {
    steps.push({
      id: 'wellbeing',
      href: getDhoPathWellbeing(lang, spaceSlug),
    });
  }
  if (steps.length < 3) {
    steps.push({
      id: 'treasury',
      href: `/${lang}/dho/${spaceSlug}/treasury`,
    });
  }
  return steps.slice(0, 3);
}

export function SpaceNextSteps({ steps }: { steps: SpaceNextStep[] }) {
  const t = useTranslations('Journey');

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
          {t('nextStepsTitle')}
        </h3>
        <p className="mt-1 text-2 text-muted-foreground">
          {t('nextStepsLead')}
        </p>
      </div>
      <div className="grid gap-3">
        {steps.map((step, index) => (
          <Link key={step.id} href={step.href} className="block">
            <Card className="craft-card-interactive">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-3 text-2 font-semibold text-accent-11">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-2 font-semibold text-foreground">
                    {t(`step.${step.id}`)}
                  </span>
                  <span className="block text-1 text-muted-foreground">
                    {t(`stepHint.${step.id}`)}
                  </span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
