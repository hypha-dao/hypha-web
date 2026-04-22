'use client';

import {
  AddAttachment,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LucideReactIcon,
  MultiSelect,
  RequirementMark,
  RichTextEditor,
} from '@hypha-platform/ui';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import {
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  CoherenceType,
} from '@hypha-platform/core/client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { CoherenceTypeButton } from './coherence-type-button';
import { CoherencePriorityButton } from './coherence-priority-button';
import { CardButtonColorVariant } from '../../common/card-button';

/** Shared subset of create/edit signal forms. */
export type SignalEditorFieldValues = {
  title: string;
  description: string;
  type: CoherenceType;
  priority: string;
  tags: string[];
  attachments?: unknown;
};

type SignalEditorFieldsProps<
  TFieldValues extends FieldValues & SignalEditorFieldValues,
> = {
  form: UseFormReturn<TFieldValues>;
  disabled?: boolean;
  showAttachments?: boolean;
};

export function SignalEditorFields<
  TFieldValues extends FieldValues & SignalEditorFieldValues,
>({
  form,
  disabled = false,
  showAttachments = true,
}: SignalEditorFieldsProps<TFieldValues>) {
  const t = useTranslations('CoherenceTab');
  const tAgreementFlow = useTranslations('AgreementFlow');

  const translateEditor = React.useCallback(
    (
      key: string,
      defaultValue: string | undefined,
      interpolations?: Record<string, string | number>,
    ) => {
      const translationKey = `createAgreementBaseFields.editor.${key}`;
      if (!tAgreementFlow.has(translationKey)) {
        return defaultValue ?? key;
      }
      return tAgreementFlow(translationKey, interpolations);
    },
    [tAgreementFlow],
  );

  const typeOptions = React.useMemo(() => {
    return COHERENCE_TYPE_OPTIONS.map(({ icon, type }) => ({
      icon: icon as LucideReactIcon,
      title: t(
        `types.${type}` as
          | 'types.Opportunity'
          | 'types.Risk'
          | 'types.Tension'
          | 'types.Insight'
          | 'types.Trend'
          | 'types.Proposal',
      ),
      description: t(
        `typeDescriptions.${type}` as
          | 'typeDescriptions.Opportunity'
          | 'typeDescriptions.Risk'
          | 'typeDescriptions.Tension'
          | 'typeDescriptions.Insight'
          | 'typeDescriptions.Trend'
          | 'typeDescriptions.Proposal',
      ),
      type,
      colorVariant: 'subtle' as CardButtonColorVariant,
      titleColor: 'var(--foreground)',
    }));
  }, [t]);

  const priorityOptions = React.useMemo(() => {
    return COHERENCE_PRIORITY_OPTIONS.map(({ priority }) => ({
      title: t(
        `priorities.${priority}` as
          | 'priorities.high'
          | 'priorities.medium'
          | 'priorities.low',
      ),
      priority,
      description: t(
        `priorityDescriptions.${priority}` as
          | 'priorityDescriptions.high'
          | 'priorityDescriptions.medium'
          | 'priorityDescriptions.low',
      ),
      colorVariant: 'subtle' as CardButtonColorVariant,
    }));
  }, [t]);

  const tagOptions = React.useMemo(() => {
    return COHERENCE_TAGS.map((tag) => ({
      value: tag,
      label: t(
        `tagLabels.${tag}` as
          | 'tagLabels.Strategy'
          | 'tagLabels.Culture'
          | 'tagLabels.Onboarding'
          | 'tagLabels.Engagement'
          | 'tagLabels.Learning'
          | 'tagLabels.Capacity'
          | 'tagLabels.Network'
          | 'tagLabels.Reputation',
      ),
    }));
  }, [t]);

  return (
    <>
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <div className="flex w-full flex-col gap-3">
              <FormLabel className="text-foreground">
                {t('type')} <RequirementMark />
              </FormLabel>
              <FormControl>
                <span className="grid w-full grid-cols-2 gap-2">
                  {typeOptions.map((option, index) => (
                    <CoherenceTypeButton
                      key={`type-option-${index}`}
                      icon={option.icon}
                      title={option.title}
                      description={option.description}
                      colorVariant={option.colorVariant}
                      selected={field.value === option.type}
                      onClick={() => {
                        form.setValue(
                          'type',
                          option.type as TFieldValues['type'],
                          {
                            shouldDirty: true,
                          },
                        );
                      }}
                    />
                  ))}
                </span>
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="priority"
        render={({ field }) => (
          <FormItem>
            <div className="flex w-full flex-col gap-3">
              <FormLabel className="text-foreground">
                {t('priority')} <RequirementMark />
              </FormLabel>
              <FormControl>
                <span className="flex w-full flex-row gap-2">
                  {priorityOptions.map((option, index) => (
                    <CoherencePriorityButton
                      key={`priority-option-${index}`}
                      className="w-full"
                      title={option.title}
                      description={option.description}
                      colorVariant={option.colorVariant}
                      selected={field.value === option.priority}
                      onClick={() => {
                        form.setValue(
                          'priority',
                          option.priority as TFieldValues['priority'],
                          { shouldDirty: true },
                        );
                      }}
                    />
                  ))}
                </span>
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="tags"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-foreground">{t('tags')}</FormLabel>
            <FormControl>
              <MultiSelect
                placeholder={t('selectOneOrMore')}
                options={tagOptions}
                value={field.value}
                allowToggleAll={false}
                onValueChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => {
          const descriptionValue = field.value || '';
          return (
            <FormItem>
              <FormLabel className="text-foreground gap-1">
                {t('description')} <RequirementMark />
              </FormLabel>
              <FormControl>
                <RichTextEditor
                  editorRef={null}
                  markdown={descriptionValue}
                  translation={translateEditor}
                  placeholder={t('descriptionPlaceholder')}
                  onChange={(markdown) => field.onChange(markdown)}
                />
              </FormControl>
              <FormDescription />
              <FormMessage />
            </FormItem>
          );
        }}
      />
      {showAttachments ? (
        <FormField
          control={form.control}
          name="attachments"
          render={({ field }) => {
            const fieldValue = field.value || [];
            const arr = Array.isArray(fieldValue) ? fieldValue : [];
            const newFiles = arr.filter((item) => item instanceof File);
            const existing = arr.filter(
              (item) =>
                typeof item === 'string' ||
                (typeof item === 'object' &&
                  item !== null &&
                  'url' in item &&
                  typeof (item as { url: unknown }).url === 'string'),
            ) as { name: string; url: string }[];

            return (
              <FormItem>
                <FormControl>
                  <AddAttachment
                    label={tAgreementFlow(
                      'createAgreementBaseFields.addAttachmentLabel',
                    )}
                    onChange={(files) => {
                      field.onChange([...existing, ...files]);
                    }}
                    value={newFiles.length > 0 ? newFiles : undefined}
                    defaultAttachments={
                      existing.length > 0 ? existing : undefined
                    }
                    onExistingAttachmentsChange={(updated) => {
                      const files = arr.filter((item) => item instanceof File);
                      field.onChange([...updated, ...files]);
                    }}
                  />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            );
          }}
        />
      ) : null}
    </>
  );
}

export function SignalTitleField<
  TFieldValues extends FieldValues & { title: string },
>({
  form,
  disabled,
  placeholder,
}: {
  form: UseFormReturn<TFieldValues>;
  disabled?: boolean;
  placeholder: string;
}) {
  return (
    <FormField
      control={form.control}
      name="title"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              placeholder={placeholder}
              className="min-h-10 bg-background py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground"
              disabled={disabled}
              rightIcon={<RequirementMark className="text-4" />}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
