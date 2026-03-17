import { z } from 'zod';
import { isBefore } from 'date-fns';
import { recipientField } from '../components/common/recipient-field.validation';

export const schemaProposeContribution = z.object({
  recipient: recipientField,
});

export type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

export type Milestone = {
  percentage: number;
  dateRange: DateRange;
};

export const validateMilestones = (milestones: Milestone[]): true | string => {
  if (!milestones || milestones.length === 0) {
    return 'Milestones cannot be empty';
  }

  const total = milestones.reduce((sum, m) => sum + m.percentage, 0);
  const now = new Date();

  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i];
    const { dateRange } = milestone;

    if (!dateRange?.from) return 'Each milestone must have a start date';

    if (i === 0 && isBefore(dateRange.from, now)) {
      return 'First milestone must be in the future';
    }

    const previous = milestones[i - 1];
    const previousFrom = previous?.dateRange?.from;
    if (i > 0 && previousFrom && isBefore(dateRange.from, previousFrom)) {
      return `Milestone ${i + 1} must be after milestone ${i}`;
    }
  }

  if (total > 100) return 'Total percentage cannot exceed 100%';

  return true;
};

export const validateFutureDate = (date: Date | undefined): true | string => {
  const now = new Date();
  if (date && isBefore(date, now)) {
    return 'The future payment date must be later than the current date';
  }
  return true;
};
