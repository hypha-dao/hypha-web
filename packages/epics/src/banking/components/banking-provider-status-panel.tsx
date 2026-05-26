'use client';

import { FC, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge, Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { bankRailNeedsEndorsementRequest } from '../banking-ui';
import { useRequestEndorsementKyc } from '../hooks/use-request-endorsement-kyc';
import {
  BANK_KYC_STATUSES,
  type BankCustomerPublicStatus,
  type BankEndorsementPublicStatus,
  type BankKycStatus,
  type BankVerificationProcedurePublic,
} from '../hooks/types';
import { openBankVerificationFlowLink } from '../open-bank-verification-tos';
import { BankingSandboxDemoBar } from './banking-sandbox-demo-bar';

export type BankingProviderStatusPanelProps = {
  spaceSlug: string;
  status: BankCustomerPublicStatus | null | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isSyncingBanking?: boolean;
  canManage: boolean;
  blockerMessage: string | null;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
  onSyncBanking?: () => void;
  /** Full-page verification view (banking tab before any rail is approved). */
  showPageHeader?: boolean;
  onOpenGear?: () => void;
};

function getInProgressStatusLabel(
  kind: 'tos' | 'kyc',
  value: string | null | undefined,
  t: ReturnType<typeof useTranslations<'BankingTab'>>,
  tTos: ReturnType<typeof useTranslations<'BankingTab.tosStatus'>>,
): string {
  if (!value) {
    return '—';
  }
  if (kind === 'tos') {
    if (value === 'pending' || value === 'approved') {
      return tTos(`${value}.title`);
    }
    return value;
  }
  if ((BANK_KYC_STATUSES as readonly string[]).includes(value)) {
    return t(`status.${value as BankKycStatus}.title`);
  }
  return value;
}

const KYB_PROCEDURE_HINT_STATUSES = [
  'not_started',
  'incomplete',
  'awaiting_questionnaire',
  'awaiting_ubo',
  'under_review',
  'approved',
  'rejected',
  'paused',
  'offboarded',
] as const;

type KybProcedureHintStatus = (typeof KYB_PROCEDURE_HINT_STATUSES)[number];

function getProcedureLinkHint(
  kind: 'tos' | 'kyc',
  procedure: BankVerificationProcedurePublic,
  tAdvanced: ReturnType<typeof useTranslations<'BankingTab.advanced'>>,
): string {
  if (procedure.isComplete) {
    return kind === 'tos'
      ? tAdvanced('procedureHints.tos.complete')
      : tAdvanced('procedureHints.kyb.complete');
  }

  const status = procedure.status;
  if (kind === 'tos') {
    if (status === 'approved') {
      return tAdvanced('procedureHints.tos.complete');
    }
    if (status === 'pending') {
      return tAdvanced('procedureHints.tos.pending');
    }
    return tAdvanced('procedureHints.fallback');
  }

  if (
    status &&
    (KYB_PROCEDURE_HINT_STATUSES as readonly string[]).includes(status)
  ) {
    return tAdvanced(`procedureHints.kyb.${status as KybProcedureHintStatus}`);
  }

  return tAdvanced('procedureHints.fallback');
}

function ProcedureRow({
  kind,
  title,
  procedure,
  openLinkLabel,
  t,
  tTos,
  tAdvanced,
}: {
  kind: 'tos' | 'kyc';
  title: string;
  procedure: BankVerificationProcedurePublic;
  openLinkLabel: string;
  t: ReturnType<typeof useTranslations<'BankingTab'>>;
  tTos: ReturnType<typeof useTranslations<'BankingTab.tosStatus'>>;
  tAdvanced: ReturnType<typeof useTranslations<'BankingTab.advanced'>>;
}) {
  const statusLabel = procedure.isComplete
    ? tAdvanced('stepCompleted')
    : getInProgressStatusLabel(kind, procedure.status, t, tTos);

  return (
    <div className="rounded-lg border border-border/80 bg-background-2/30 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-2 font-medium text-foreground">{title}</p>
        <Badge
          variant={procedure.isComplete ? 'soft' : 'outline'}
          colorVariant={procedure.isComplete ? 'success' : 'neutral'}
          className={cn(
            'pointer-events-none cursor-default text-1 shadow-none transition-none',
            'hover:shadow-none focus:ring-0 focus:ring-offset-0',
            procedure.isComplete
              ? 'hover:bg-success-3 hover:text-success-11'
              : 'hover:border-neutral-8 hover:bg-transparent hover:text-neutral-11 hover:ring-transparent',
          )}
        >
          {statusLabel}
        </Badge>
      </div>
      {procedure.action?.url || procedure.link ? (
        <div className="mt-3">
          {procedure.linkDisabled ? (
            <p className="text-1 text-muted-foreground">
              {getProcedureLinkHint(kind, procedure, tAdvanced)}
            </p>
          ) : (
            <Button colorVariant="accent" size="sm" className="w-fit" asChild>
              <Link
                href={procedure.action?.url ?? procedure.link ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                {openLinkLabel}
              </Link>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

const KNOWN_BRIDGE_ENDORSEMENTS = [
  'base',
  'sepa',
  'spei',
  'pix',
  'faster_payments',
  'cop',
] as const;

function getEndorsementLabel(
  endorsement: string,
  tEndorsements: ReturnType<typeof useTranslations<'BankingTab.endorsements'>>,
): string {
  if (
    (KNOWN_BRIDGE_ENDORSEMENTS as readonly string[]).includes(endorsement)
  ) {
    return tEndorsements(
      endorsement as (typeof KNOWN_BRIDGE_ENDORSEMENTS)[number],
    );
  }
  return endorsement.toUpperCase();
}

function EndorsementValidationsList({
  spaceSlug,
  endorsements,
  t,
  tAdvanced,
  tOpenAccount,
  tEndorsements,
  onOpenGear,
  onRefreshStatus,
}: {
  spaceSlug: string;
  endorsements: BankEndorsementPublicStatus[];
  t: ReturnType<typeof useTranslations<'BankingTab'>>;
  tAdvanced: ReturnType<typeof useTranslations<'BankingTab.advanced'>>;
  tOpenAccount: ReturnType<typeof useTranslations<'BankingTab.openAccount'>>;
  tEndorsements: ReturnType<typeof useTranslations<'BankingTab.endorsements'>>;
  onOpenGear?: () => void;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
}) {
  const { requestEndorsementKyc, isLoading: isVerifying } =
    useRequestEndorsementKyc(spaceSlug);

  const handleVerify = useCallback(
    async (endorsement: string) => {
      const { kycLinkUrl } = await requestEndorsementKyc(endorsement);
      window.open(kycLinkUrl, '_blank', 'noopener,noreferrer');
      onOpenGear?.();
      await onRefreshStatus();
    },
    [onOpenGear, onRefreshStatus, requestEndorsementKyc],
  );

  if (endorsements.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/80 bg-background-2/30 px-3 py-3">
      <p className="text-2 font-medium text-foreground">
        {tAdvanced('currencyValidationsTitle')}
      </p>
      <dl className="mt-3 flex flex-col gap-2">
        {endorsements.map((entry) => (
          <div
            key={entry.endorsement}
            className="flex items-center justify-between gap-3 py-0.5"
          >
            <dt className="min-w-0 text-2 font-medium text-foreground">
              {getEndorsementLabel(entry.endorsement, tEndorsements)}
            </dt>
            <dd className="flex shrink-0 items-center gap-2">
              <Badge
                variant="outline"
                colorVariant={
                  entry.operationalStatus === 'active'
                    ? 'success'
                    : entry.operationalStatus === 'approved'
                    ? 'accent'
                    : 'neutral'
                }
                className="pointer-events-none cursor-default text-1 shadow-none"
              >
                {tAdvanced(
                  `currencyStatus.${entry.operationalStatus}` as
                    | 'currencyStatus.active'
                    | 'currencyStatus.approved'
                    | 'currencyStatus.pending'
                    | 'currencyStatus.not_approved'
                    | 'currencyStatus.not_requested',
                )}
              </Badge>
              {bankRailNeedsEndorsementRequest(entry.operationalStatus) ? (
                <Button
                  type="button"
                  colorVariant="accent"
                  className="h-auto min-h-0 shrink-0 px-2.5 py-1 text-1 leading-tight"
                  disabled={isVerifying}
                  onClick={() => void handleVerify(entry.endorsement)}
                >
                  {tOpenAccount('requestRail')}
                </Button>
              ) : entry.validation?.action?.url &&
                !entry.validation.linkDisabled ? (
                <Button
                  colorVariant="accent"
                  className="h-auto min-h-0 shrink-0 px-2 py-0.5 text-1 leading-tight"
                  asChild
                >
                  <Link
                    href={entry.validation.action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('actions.openVerificationForm')}
                  </Link>
                </Button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ProviderValidationsSection({
  spaceSlug,
  status,
  t,
  tTos,
  tAdvanced,
  tOpenAccount,
  tEndorsements,
  showProcedures,
  onOpenGear,
  onRefreshStatus,
}: {
  spaceSlug: string;
  status: NonNullable<BankCustomerPublicStatus>;
  t: ReturnType<typeof useTranslations<'BankingTab'>>;
  tTos: ReturnType<typeof useTranslations<'BankingTab.tosStatus'>>;
  tAdvanced: ReturnType<typeof useTranslations<'BankingTab.advanced'>>;
  tOpenAccount: ReturnType<typeof useTranslations<'BankingTab.openAccount'>>;
  tEndorsements: ReturnType<typeof useTranslations<'BankingTab.endorsements'>>;
  showProcedures: boolean;
  onOpenGear?: () => void;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-2 font-semibold text-foreground">
        {tAdvanced('providerValidationsTitle')}
      </h3>

      <p className="mt-2 text-1 text-muted-foreground">
        {tAdvanced('dataMinimizationNotice')}
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {showProcedures ? (
          <>
            <ProcedureRow
              kind="tos"
              title={tAdvanced('tosProcedure')}
              procedure={status.procedures.tos}
              openLinkLabel={t('actions.viewTerms')}
              t={t}
              tTos={tTos}
              tAdvanced={tAdvanced}
            />
            <ProcedureRow
              kind="kyc"
              title={tAdvanced('kybProcedure')}
              procedure={status.procedures.kyc}
              openLinkLabel={t('actions.openVerificationForm')}
              t={t}
              tTos={tTos}
              tAdvanced={tAdvanced}
            />
          </>
        ) : null}

        <EndorsementValidationsList
          spaceSlug={spaceSlug}
          endorsements={
            status.endorsementStatuses.length > 0
              ? status.endorsementStatuses
              : status.currencyStatuses.map((entry) => ({
                  endorsement: entry.endorsement,
                  endorsementStatus: entry.endorsementStatus,
                  operationalStatus: entry.operationalStatus,
                  validation: entry.validation ?? {
                    key: entry.endorsement,
                    status: entry.endorsementStatus,
                    isComplete: entry.isApproved,
                  },
                }))
          }
          t={t}
          tAdvanced={tAdvanced}
          tOpenAccount={tOpenAccount}
          tEndorsements={tEndorsements}
          onOpenGear={onOpenGear}
          onRefreshStatus={onRefreshStatus}
        />
      </div>
    </section>
  );
}

export const BankingProviderStatusPanel: FC<BankingProviderStatusPanelProps> = ({
  spaceSlug,
  status,
  isLoading,
  isRefreshing,
  isSyncingBanking = false,
  canManage,
  blockerMessage,
  onRefreshStatus,
  onSyncBanking,
  showPageHeader = false,
  onOpenGear,
}) => {
  const t = useTranslations('BankingTab');
  const tTos = useTranslations('BankingTab.tosStatus');
  const tAdvanced = useTranslations('BankingTab.advanced');
  const tOpenAccount = useTranslations('BankingTab.openAccount');
  const tEndorsements = useTranslations('BankingTab.endorsements');

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-2">{t('loading')}</span>
        </div>
      );
    }

    if (status == null) {
      return (
        <p className="text-2 text-muted-foreground">
          {tAdvanced('noCustomer')}
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {status.approvalRegistered ? (
          <p className="text-2 text-muted-foreground">
            {tAdvanced('approvedSummary')}
          </p>
        ) : null}
        <ProviderValidationsSection
          spaceSlug={spaceSlug}
          status={status}
          t={t}
          tTos={tTos}
          tAdvanced={tAdvanced}
          tOpenAccount={tOpenAccount}
          tEndorsements={tEndorsements}
          showProcedures={!status.approvalRegistered}
          onOpenGear={onOpenGear}
          onRefreshStatus={onRefreshStatus}
        />
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex w-full max-w-lg flex-col gap-4',
        showPageHeader && 'mx-auto',
      )}
    >
      {showPageHeader ? (
        <div className="min-w-0">
          <h2 className="text-3 font-semibold tracking-tight text-foreground">
            {tAdvanced('dialogTitle')}
          </h2>
          <p className="mt-1 text-2 text-muted-foreground">
            {tAdvanced('dialogDescription')}
          </p>
        </div>
      ) : null}

      {blockerMessage ? (
        <p className="text-2 text-muted-foreground">{blockerMessage}</p>
      ) : null}

      {renderBody()}

      {!isLoading && status != null && canManage && onSyncBanking ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={isSyncingBanking || isRefreshing}
          onClick={() => onSyncBanking()}
        >
          {isSyncingBanking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tAdvanced('syncingStatus')}
            </>
          ) : (
            tAdvanced('syncStatus')
          )}
        </Button>
      ) : null}

      {!isLoading &&
      status != null &&
      !status.approvalRegistered &&
      !status.isApproved ? (
        <BankingSandboxDemoBar
          spaceSlug={spaceSlug}
          canManage={canManage}
          isRefreshing={isRefreshing}
          onRefreshStatus={onRefreshStatus}
        />
      ) : null}
    </div>
  );
};
