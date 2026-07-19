'use client';

import { formatISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { PaymentSchedule } from '@hypha-platform/core/client';

type ProposalPaymentScheduleInfoProps = {
  schedule: PaymentSchedule;
};

function formatScheduleDate(date: Date | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) {
    return undefined;
  }
  return formatISO(date, { representation: 'date' });
}

export function ProposalPaymentScheduleInfo({
  schedule,
}: ProposalPaymentScheduleInfoProps) {
  const t = useTranslations('ProposalDetails.paymentSchedule');

  const optionLabel =
    schedule.option === 'Immediately'
      ? t('immediately')
      : schedule.option === 'Future Payment'
        ? t('futurePayment')
        : t('milestones');

  return (
    <div className="flex flex-col gap-3">
      <span className="text-neutral-11 text-2 font-medium">{t('title')}</span>
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-6 bg-neutral-2 p-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <span className="text-sm text-neutral-11">{t('label')}</span>
          <span className="text-sm text-foreground">{optionLabel}</span>
        </div>

        {schedule.option === 'Future Payment' && schedule.futureDate ? (
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-neutral-11">{t('date')}</span>
            <span className="text-sm text-foreground">
              {formatScheduleDate(schedule.futureDate)}
            </span>
          </div>
        ) : null}

        {schedule.option === 'Milestones' && schedule.milestones?.length ? (
          <div className="flex flex-col gap-2">
            {schedule.milestones.map((milestone, index) => (
              <div
                key={`milestone-${index}`}
                className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
              >
                <span className="text-sm text-neutral-11">
                  {t('milestoneLabel', { index: index + 1 })}
                </span>
                <span className="text-sm text-foreground">
                  {t('milestoneRow', {
                    percentage: milestone.percentage,
                    date:
                      formatScheduleDate(milestone.dateRange?.from) ??
                      t('datePending'),
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {schedule.option !== 'Immediately' ? (
          <p className="text-sm text-neutral-11">{t('deferredNote')}</p>
        ) : null}
      </div>
    </div>
  );
}
