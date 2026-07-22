import type { z } from 'zod';
import type {
  paymentScheduleSchema,
  PaymentScheduleOption,
} from './validation';

export type PaymentSchedule = z.infer<typeof paymentScheduleSchema>;

export type ContributionPayout = {
  amount: string;
  token: string;
};

export type ProposeContributionMetadata = {
  recipient: string;
  payouts: ContributionPayout[];
  paymentSchedule: PaymentSchedule;
};

export type DocumentMetadata = {
  proposeContribution?: ProposeContributionMetadata;
};

type SerializedDateRange = {
  from?: string;
  to?: string;
};

type SerializedMilestone = {
  percentage: number;
  dateRange?: SerializedDateRange;
};

export type SerializedPaymentSchedule = {
  option: PaymentScheduleOption;
  futureDate?: string;
  milestones?: SerializedMilestone[];
};

function serializeDate(date: Date | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

export function serializePaymentSchedule(
  schedule: PaymentSchedule | undefined,
): SerializedPaymentSchedule {
  const option = schedule?.option ?? 'Immediately';

  if (option === 'Future Payment') {
    return {
      option,
      futureDate: serializeDate(schedule?.futureDate),
    };
  }

  if (option === 'Milestones') {
    return {
      option,
      milestones: (schedule?.milestones ?? []).map((milestone) => ({
        percentage: milestone.percentage,
        dateRange: milestone.dateRange
          ? {
              from: serializeDate(milestone.dateRange.from),
              to: serializeDate(milestone.dateRange.to),
            }
          : undefined,
      })),
    };
  }

  return { option: 'Immediately' };
}

export function deserializePaymentSchedule(
  schedule: SerializedPaymentSchedule | undefined,
): PaymentSchedule {
  if (!schedule) {
    return { option: 'Immediately' };
  }

  if (schedule.option === 'Future Payment') {
    return {
      option: 'Future Payment',
      futureDate: parseDate(schedule.futureDate),
    };
  }

  if (schedule.option === 'Milestones') {
    return {
      option: 'Milestones',
      milestones: (schedule.milestones ?? []).map((milestone) => ({
        percentage: milestone.percentage,
        dateRange: milestone.dateRange
          ? {
              from: parseDate(milestone.dateRange.from),
              to: parseDate(milestone.dateRange.to),
            }
          : { from: undefined, to: undefined },
      })),
    };
  }

  return { option: 'Immediately' };
}

export function buildProposeContributionMetadata(input: {
  recipient: string;
  payouts: ContributionPayout[];
  paymentSchedule?: PaymentSchedule;
}): DocumentMetadata {
  return {
    proposeContribution: {
      recipient: input.recipient,
      payouts: input.payouts,
      paymentSchedule: {
        option: input.paymentSchedule?.option ?? 'Immediately',
        ...(input.paymentSchedule?.option === 'Future Payment'
          ? { futureDate: input.paymentSchedule.futureDate }
          : {}),
        ...(input.paymentSchedule?.option === 'Milestones'
          ? { milestones: input.paymentSchedule.milestones }
          : {}),
      },
    },
  };
}

export function serializeDocumentMetadata(
  metadata: DocumentMetadata | undefined,
): Record<string, unknown> | undefined {
  if (!metadata?.proposeContribution) {
    return metadata as Record<string, unknown> | undefined;
  }

  const { proposeContribution } = metadata;
  return {
    proposeContribution: {
      recipient: proposeContribution.recipient,
      payouts: proposeContribution.payouts,
      paymentSchedule: serializePaymentSchedule(
        proposeContribution.paymentSchedule,
      ),
    },
  };
}

export function parseDocumentMetadata(
  value: unknown,
): DocumentMetadata | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const contribution = raw.proposeContribution;
  if (!contribution || typeof contribution !== 'object') {
    return undefined;
  }

  const c = contribution as Record<string, unknown>;
  const recipient = typeof c.recipient === 'string' ? c.recipient : '';
  const payouts = Array.isArray(c.payouts)
    ? c.payouts
        .filter(
          (p): p is ContributionPayout =>
            !!p &&
            typeof p === 'object' &&
            typeof (p as ContributionPayout).amount === 'string' &&
            typeof (p as ContributionPayout).token === 'string',
        )
        .map((p) => ({
          amount: p.amount,
          token: p.token,
        }))
    : [];

  const scheduleRaw = c.paymentSchedule as
    | SerializedPaymentSchedule
    | undefined;

  return {
    proposeContribution: {
      recipient,
      payouts,
      paymentSchedule: deserializePaymentSchedule(scheduleRaw),
    },
  };
}

export function isImmediatePaymentSchedule(
  schedule: PaymentSchedule | undefined,
): boolean {
  return !schedule || schedule.option === 'Immediately';
}
