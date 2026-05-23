'use client';

import { FC } from 'react';
import { Loader2, Settings } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  BANK_KYC_STATUSES,
  type BankCustomerPublicStatus,
  type BankKycStatus,
  type BankVerificationProcedurePublic,
} from '../hooks/types';
import { BankingSandboxDemoBar } from './banking-sandbox-demo-bar';

type BankingAdvancedDialogProps = {
  spaceSlug: string;
  status: BankCustomerPublicStatus | null | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  canManage: boolean;
  blockerMessage: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
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
      {procedure.link ? (
        <div className="mt-3">
          {procedure.linkDisabled ? (
            <p className="text-1 text-muted-foreground">
              {getProcedureLinkHint(kind, procedure, tAdvanced)}
            </p>
          ) : (
            <Button colorVariant="accent" size="sm" className="w-fit" asChild>
              <Link
                href={procedure.link}
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

function CurrencyValidationsList({
  status,
  tAdvanced,
}: {
  status: NonNullable<BankCustomerPublicStatus>;
  tAdvanced: ReturnType<typeof useTranslations<'BankingTab.advanced'>>;
}) {
  if (status.currencyStatuses.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/80 bg-background-2/30 px-3 py-3">
      <p className="text-2 font-medium text-foreground">
        {tAdvanced('currencyValidationsTitle')}
      </p>
      <dl className="mt-3 flex flex-col gap-1.5">
        {status.currencyStatuses.map((entry) => {
          const currencyId = entry.currency.toUpperCase();

          return (
            <div
              key={entry.currency}
              className="flex items-center justify-between gap-3 py-0.5"
            >
              <dt className="text-2 font-medium tabular-nums text-foreground">
                {currencyId}
              </dt>
              <dd className="flex shrink-0 items-center">
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
                      | 'currencyStatus.not_opened',
                  )}
                </Badge>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function ProviderValidationsSection({
  status,
  t,
  tTos,
  tAdvanced,
  showCustomerDetails,
  showProcedures,
}: {
  status: NonNullable<BankCustomerPublicStatus>;
  t: ReturnType<typeof useTranslations<'BankingTab'>>;
  tTos: ReturnType<typeof useTranslations<'BankingTab.tosStatus'>>;
  tAdvanced: ReturnType<typeof useTranslations<'BankingTab.advanced'>>;
  showCustomerDetails: boolean;
  showProcedures: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-2 font-semibold text-foreground">
        {tAdvanced('providerValidationsTitle')}
      </h3>

      {showCustomerDetails ? (
        <dl className="mt-3 grid gap-2 rounded-md border border-border/60 bg-background-2/40 px-3 py-3 text-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="font-medium text-muted-foreground">
            {tAdvanced('legalNameLabel')}
          </dt>
          <dd className="text-foreground">{status.name}</dd>
          <dt className="font-medium text-muted-foreground">
            {tAdvanced('contactEmailLabel')}
          </dt>
          <dd className="break-all text-foreground">{status.contactEmail}</dd>
        </dl>
      ) : null}

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

        <CurrencyValidationsList status={status} tAdvanced={tAdvanced} />
      </div>
    </section>
  );
}

export const BankingAdvancedDialog: FC<BankingAdvancedDialogProps> = ({
  spaceSlug,
  status,
  isLoading,
  isRefreshing,
  canManage,
  blockerMessage,
  open,
  onOpenChange,
  onRefreshStatus,
}) => {
  const t = useTranslations('BankingTab');
  const tTos = useTranslations('BankingTab.tosStatus');
  const tAdvanced = useTranslations('BankingTab.advanced');

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
          status={status}
          t={t}
          tTos={tTos}
          tAdvanced={tAdvanced}
          showCustomerDetails={!status.approvalRegistered}
          showProcedures={!status.approvalRegistered}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={tAdvanced('gearLabel')}
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tAdvanced('dialogTitle')}</DialogTitle>
          <DialogDescription>
            {tAdvanced('dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {blockerMessage ? (
            <p className="text-2 text-muted-foreground">{blockerMessage}</p>
          ) : null}

          {renderBody()}

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
      </DialogContent>
    </Dialog>
  );
};
