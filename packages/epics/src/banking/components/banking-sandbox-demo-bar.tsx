'use client';

import { FC, useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';

import { useSimulateKycApproval } from '../hooks/use-simulate-kyc-approval';
import { BANKING_SANDBOX_DEMO_ENABLED } from '../sandbox-demo';

type BankingSandboxDemoBarProps = {
  spaceSlug: string;
  canManage: boolean;
};

export const BankingSandboxDemoBar: FC<BankingSandboxDemoBarProps> = ({
  spaceSlug,
  canManage,
}) => {
  const t = useTranslations('BankingTab.sandboxDemo');
  const { simulateApproval, isSimulating, error, clearError } =
    useSimulateKycApproval({ spaceSlug });
  const [bridgeApproved, setBridgeApproved] = useState(false);

  if (!BANKING_SANDBOX_DEMO_ENABLED) {
    return null;
  }

  const handleSimulate = () => {
    clearError();
    setBridgeApproved(false);
    void simulateApproval()
      .then(() => setBridgeApproved(true))
      .catch(() => undefined);
  };

  return (
    <div
      className="rounded-lg border border-dashed border-warning-7 bg-warning-2/40 px-4 py-3"
      data-testid="banking-sandbox-demo-bar"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <FlaskConical
            className="mt-0.5 h-5 w-5 shrink-0 text-warning-11"
            aria-hidden
          />
          <div>
            <p className="text-2 font-medium text-warning-12">{t('title')}</p>
            <p className="mt-0.5 max-w-2xl text-2 text-warning-11">
              {t('description')}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit shrink-0 border-warning-7 text-warning-12 hover:bg-warning-3"
          disabled={!canManage || isSimulating || bridgeApproved}
          onClick={handleSimulate}
        >
          {isSimulating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('simulating')}
            </>
          ) : (
            t('cta')
          )}
        </Button>
      </div>
      {bridgeApproved ? (
        <p className="mt-2 text-2 font-medium text-warning-12">
          {t('successRefreshHint')}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-2 text-error-11">{error}</p> : null}
    </div>
  );
};
