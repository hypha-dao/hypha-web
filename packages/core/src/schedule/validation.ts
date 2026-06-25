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

const scheduledItemUrlSchema = z
  .string()
  .trim()
  .url({ message: 'Enter a valid URL' })
  .max(2000)
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((value) => (value ? value : null));

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

const recurrencePresetSchema = z.enum(RECURRENCE_PRESETS).optional();

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
  remindEmail: z.boolean().optional().default(false),
  remindPush: z.boolean().optional().default(false),
  reminderMinutesBefore: reminderMinutesSchema,
};

function resolveRecurrenceRule(data: {
  recurrencePreset?: z.infer<typeof recurrencePresetSchema>;
  recurrenceRule?: string | null;
  startsAt: Date;
}) {
  if (data.recurrencePreset && data.recurrencePreset !== 'none') {
    return buildRecurrenceRuleFromPreset(data.recurrencePreset, data.startsAt);
  }
  return data.recurrenceRule ?? null;
}

function validateReminderSettings(
  data: {
    remindEmail?: boolean;
    remindPush?: boolean;
    reminderMinutesBefore?: number | null;
  },
  ctx: z.RefinementCtx,
) {
  const wantsReminder = Boolean(data.remindEmail || data.remindPush);
  if (wantsReminder && data.reminderMinutesBefore == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Choose when to send reminders',
      path: ['reminderMinutesBefore'],
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
    validateReminderSettings(data, ctx);
  });

export const schemaUpdateScheduledItem = z
  .object({
    id: z.number().int().positive(),
    ...scheduledItemBaseFields,
  })
  .partial({
    title: true,
    description: true,
    type: true,
    startsAt: true,
    endsAt: true,
    allDay: true,
    timezone: true,
    location: true,
    meetingUrl: true,
    color: true,
    recurrenceRule: true,
    recurrenceUntil: true,
    recurrencePreset: true,
    matrixRoomId: true,
    matrixAutoLink: true,
    remindEmail: true,
    remindPush: true,
    reminderMinutesBefore: true,
  })
  .transform((data) => {
    if (data.recurrencePreset && data.startsAt) {
      return {
        ...data,
        recurrenceRule: resolveRecurrenceRule({
          recurrencePreset: data.recurrencePreset,
          recurrenceRule: data.recurrenceRule,
          startsAt: data.startsAt,
        }),
      };
    }
    return data;
  })
  .superRefine((data, ctx) => {
    if (
      data.startsAt &&
      data.endsAt &&
      data.endsAt.getTime() < data.startsAt.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endsAt'],
      });
    }
    validateReminderSettings(data, ctx);
  });

export const schemaScheduledItemsRangeQuery = z.object({
  from: scheduledItemDateSchema,
  to: scheduledItemDateSchema,
});
