import { z } from 'zod';
import { SCHEDULED_ITEM_TYPES } from './scheduled-item-types';
import {
  RECURRENCE_PRESETS,
  REMINDER_MINUTES_OPTIONS,
} from './recurrence-presets';
import { buildRecurrenceRuleFromPreset } from './recurrence';

const scheduledItemTitleSchema = z
  .string()
  .trim()
  .min(1, { message: 'Title is required' })
  .max(200);

const scheduledItemDescriptionSchema = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => value ?? null);

const scheduledItemOptionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => value ?? null);

function isValidMeetingUrl(value: string): boolean {
  if (value.startsWith('/')) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const scheduledItemUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((value) => (value ? value : null))
  .refine((value) => value == null || isValidMeetingUrl(value), {
    message: 'Enter a valid URL',
  });

const scheduledItemColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #6366f1')
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((value) => (value ? value : null));

const scheduledItemDateSchema = z.coerce.date();

const recurrenceRuleSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => value ?? null);

const recurrencePresetSchema = z.preprocess((value) => {
  if (value === '') return 'none';
  if (value == null) return undefined;
  return value;
}, z.enum(RECURRENCE_PRESETS).optional());

const reminderMinutesSchema = z
  .number()
  .int()
  .refine(
    (value) => (REMINDER_MINUTES_OPTIONS as readonly number[]).includes(value),
    'Invalid reminder offset',
  )
  .optional()
  .nullable();

const scheduledItemBaseFields = {
  title: scheduledItemTitleSchema,
  description: scheduledItemDescriptionSchema,
  type: z.enum(SCHEDULED_ITEM_TYPES),
  startsAt: scheduledItemDateSchema,
  endsAt: scheduledItemDateSchema,
  allDay: z.boolean().optional().default(false),
  timezone: scheduledItemOptionalTextSchema,
  location: scheduledItemOptionalTextSchema,
  meetingUrl: scheduledItemUrlSchema,
  color: scheduledItemColorSchema,
  recurrenceRule: recurrenceRuleSchema,
  recurrenceUntil: scheduledItemDateSchema.optional().nullable(),
  recurrencePreset: recurrencePresetSchema,
  matrixRoomId: scheduledItemOptionalTextSchema,
  matrixAutoLink: z.boolean().optional().default(false),
  reminderMinutesBefore: reminderMinutesSchema,
  coherenceId: z.number().int().positive().optional().nullable(),
};

function resolveRecurrenceRule(data: {
  recurrencePreset?: z.infer<typeof recurrencePresetSchema>;
  recurrenceRule?: string | null;
  startsAt: Date;
  timezone?: string | null;
}) {
  if (data.recurrencePreset === 'none') {
    return null;
  }
  if (data.recurrencePreset) {
    return buildRecurrenceRuleFromPreset(
      data.recurrencePreset,
      data.startsAt,
      data.timezone,
    );
  }
  return data.recurrenceRule ?? null;
}

function validateRecurrenceUntil(
  data: {
    startsAt?: Date;
    recurrenceUntil?: Date | null;
    recurrencePreset?: z.infer<typeof recurrencePresetSchema>;
  },
  ctx: z.RefinementCtx,
) {
  if (
    data.recurrenceUntil &&
    data.startsAt &&
    data.recurrenceUntil.getTime() < data.startsAt.getTime()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Repeat-until must be on or after the start time',
      path: ['recurrenceUntil'],
    });
  }
}

export const schemaCreateScheduledItem = z
  .object({
    spaceId: z.number().int().positive(),
    ...scheduledItemBaseFields,
  })
  .transform((data) => ({
    ...data,
    recurrenceRule: resolveRecurrenceRule(data),
  }))
  .superRefine((data, ctx) => {
    if (data.endsAt.getTime() < data.startsAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endsAt'],
      });
    }
    validateRecurrenceUntil(data, ctx);
  });

export const schemaMergedScheduledItemUpdate = z
  .object({
    id: z.number().int().positive(),
    ...scheduledItemBaseFields,
  })
  .transform((data) => ({
    ...data,
    recurrenceRule: resolveRecurrenceRule(data),
  }))
  .superRefine((data, ctx) => {
    if (data.endsAt.getTime() < data.startsAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endsAt'],
      });
    }
    validateRecurrenceUntil(data, ctx);
  });

/** Validated only after {@link mergeScheduledItemUpdateInput} merges a patch. */
export const schemaUpdateScheduledItem = schemaMergedScheduledItemUpdate;

export const schemaScheduledItemsRangeQuery = z
  .object({
    from: scheduledItemDateSchema,
    to: scheduledItemDateSchema,
  })
  .refine((data) => data.from.getTime() <= data.to.getTime(), {
    message: '"from" must be before or equal to "to"',
    path: ['to'],
  });
