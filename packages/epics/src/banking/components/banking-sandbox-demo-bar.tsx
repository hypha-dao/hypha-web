'use client';

import { FC, useCallback, useState } from 'react';
import { CircleHelp, FlaskConical, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Button,
  Label,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';

import type { BankCustomerPublicStatus } from '../hooks/types';
import { useSimulateKycApproval } from '../hooks/use-simulate-kyc-approval';
import { BANKING_SANDBOX_DEMO_ENABLED } from '../sandbox-demo';

type BankingSandboxDemoBarProps = {
  spaceSlug: string;
  canManage: boolean;
  isRefreshing: boolean;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
};

export const BankingSandboxDemoBar: FC<BankingSandboxDemoBarProps> = ({
  spaceSlug,
  canManage,
  isRefreshing,
  onRefreshStatus,
}) => {
  const t = useTranslations('BankingTab.sandboxDemo');
  const { simulateApproval, isSimulating, error, clearError } =
    useSimulateKycApproval({ spaceSlug });
  const [simulateKybData, setSimulateKybData] = useState(true);
  const [infoTooltipOpen, setInfoTooltipOpen] = useState(false);

  const showInfoTooltip = useCallback(() => setInfoTooltipOpen(true), []);
  const hideInfoTooltip = useCallback(() => setInfoTooltipOpen(false), []);
  const toggleInfoTooltip = useCallback(
    () => setInfoTooltipOpen((open) => !open),
    [],
  );

  if (!BANKING_SANDBOX_DEMO_ENABLED) {
    return null;
  }

  const handleSimulate = () => {
    clearError();
    void simulateApproval({ includeKybData: simulateKybData })
      .then(() => onRefreshStatus())
      .catch(() => undefined);
  };

  const controlsDisabled = !canManage || isSimulating || isRefreshing;

  return (
    <div
      className="rounded-lg border border-dashed border-warning-7 bg-warning-2/40 px-4 py-3"
      data-testid="banking-sandbox-demo-bar"
    >
      <div className="flex gap-3">
        <FlaskConical
          className="mt-0.5 h-5 w-5 shrink-0 text-warning-11"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-2 font-medium leading-snug text-warning-12">
              {t('title')}
            </p>
            <Tooltip
              open={infoTooltipOpen}
              onOpenChange={() => {
                /* Hover/click only — ignore Radix focus opens inside dialogs */
              }}
              delayDuration={80}
            >
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t('infoTooltipAria')}
                  aria-expanded={infoTooltipOpen}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-warning-11 transition-colors hover:text-warning-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-8"
                  onPointerEnter={showInfoTooltip}
                  onPointerLeave={hideInfoTooltip}
                  onClick={(event) => {
                    event.preventDefault();
                    if (!window.matchMedia('(hover: hover)').matches) {
                      toggleInfoTooltip();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleInfoTooltip();
                    }
                  }}
                  onBlur={hideInfoTooltip}
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="max-w-sm text-xs leading-relaxed"
              >
                {t('description')}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full shrink-0 border-warning-7 text-warning-12 hover:bg-warning-3 sm:w-auto"
              disabled={controlsDisabled}
              onClick={handleSimulate}
            >
              {isSimulating || isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSimulating ? t('simulating') : t('refreshing')}
                </>
              ) : (
                t('cta')
              )}
            </Button>
            <div className="flex min-w-0 items-center gap-2 sm:flex-1">
              <Switch
                id="banking-sandbox-simulate-kyb-data"
                checked={simulateKybData}
                onCheckedChange={setSimulateKybData}
                disabled={controlsDisabled}
              />
              <Label
                htmlFor="banking-sandbox-simulate-kyb-data"
                className="cursor-pointer text-2 font-normal leading-snug text-warning-12"
              >
                {t('simulateFillingKybRequiredData')}
              </Label>
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="mt-3 ps-8 text-2 text-error-11">{error}</p> : null}
    </div>
  );
};
