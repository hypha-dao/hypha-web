'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LucideReactIcon,
  RequirementMark,
  Skeleton,
  Switch,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  COHERENCE_PRIORITY_OPTIONS,
  parseCapitalKeys,
  type CapitalKey,
  type SignalFormValues,
} from '@hypha-platform/core/client';
import { CapitalChoice } from '../../../spaces/components/capital-choice';
import { CardButtonColorVariant } from '../../../common/card-button';
import { TokenPayoutFieldArray } from '../../../agreements';
import { useTokens } from '../../../treasury/hooks/use-tokens';
import { CoherencePriorityButton } from '../coherence-priority-button';
import {
  dueDateFromInputValue,
  toLocalDueDateInputValue,
} from '../../utils/signal-due-date';

/**
 * Hidden legacy signal fields (#2763 D5): not rendered anywhere since #2764;
 * the columns and stored values are kept. Tags and board moved out to
 * first-class fields (`signal-tags-field.tsx`, `signal-board-field.tsx`).
 *
 * The control stays absolutely positioned in the form's existing lower-right
 * padding. Opened fields are in normal flow, directly above the button row.
 */
export function LegacySignalFieldsDisclosure({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        data-testid="legacy-signal-fields-toggle"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="absolute right-0 top-2 z-10 inline-flex size-3.5 items-center justify-center border-0 bg-transparent p-0 text-muted-foreground/30 hover:text-muted-foreground/55"
      >
        <ChevronDown
          className={cn('size-3', open && 'rotate-180')}
          strokeWidth={1.5}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          data-testid="legacy-signal-fields-panel"
          className="w-full self-stretch"
        >
          <LegacySignalFieldsForm disabled={disabled} />
        </div>
      ) : null}
    </>
  );
}

function LegacySignalFieldsForm({ disabled }: { disabled: boolean }) {
  const form = useFormContext<SignalFormValues>();
  const params = useParams<{ id?: string }>();
  const spaceSlug = typeof params?.id === 'string' ? params.id.trim() : '';
  const t = useTranslations('CoherenceTab');
  const tCapitals = useTranslations('NetworkExchange');
  const { tokens, isLoading: isLoadingTokens } = useTokens({ spaceSlug });
  const priorityOptions = React.useMemo(() => {
    return COHERENCE_PRIORITY_OPTIONS.map(
      ({ priority, icon, colorVariant }) => ({
        icon: icon as LucideReactIcon,
        title: t.has(`priorities.${priority}` as never)
          ? t(`priorities.${priority}` as never)
          : priority,
        priority,
        description: t.has(`priorityDescriptions.${priority}` as never)
          ? t(`priorityDescriptions.${priority}` as never)
          : '',
        colorVariant: 'subtle' as CardButtonColorVariant,
        iconColorVariant: colorVariant as CardButtonColorVariant,
      }),
    );
  }, [t]);

  return (
    <div className="flex flex-col gap-6">
      <FormField
        control={form.control}
        name="sharedWithNetwork"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <FormLabel className="text-sm font-medium text-foreground">
                  {t('shareWithNetwork')}
                </FormLabel>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t('shareWithNetworkHint')}
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value === true}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                  aria-label={t('shareWithNetwork')}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="capitals"
        render={({ field }) => (
          <FormItem className="border-t border-border pt-6">
            <FormLabel className="text-foreground">
              {tCapitals('formsOfCapital')}
            </FormLabel>
            <FormDescription>{tCapitals('capitalHintMany')}</FormDescription>
            <CapitalChoice
              mode="many"
              selected={parseCapitalKeys(field.value)}
              disabled={disabled}
              onChange={(next: CapitalKey[]) => field.onChange(next)}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="priority"
        render={({ field }) => (
          <FormItem
            className="border-t border-border pt-6"
            data-signal-field="priority"
          >
            <div className="flex w-full flex-col gap-3">
              <FormLabel className="text-foreground">
                {t('priority')} <RequirementMark />
              </FormLabel>
              <FormControl>
                <span className="flex w-full flex-row gap-2">
                  {priorityOptions.map((option) => (
                    <CoherencePriorityButton
                      key={`priority-option-${option.priority}`}
                      className="w-full"
                      icon={option.icon}
                      title={option.title}
                      description={option.description}
                      colorVariant={option.colorVariant}
                      iconColorVariant={option.iconColorVariant}
                      selected={field.value === option.priority}
                      onClick={() => {
                        form.setValue('priority', option.priority, {
                          shouldDirty: true,
                        });
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
        name="dueAt"
        render={({ field }) => (
          <FormItem className="border-t border-border pt-6">
            <FormLabel className="text-foreground">
              {t('signalFormDueDate')}
            </FormLabel>
            <FormControl>
              <Input
                type="date"
                disabled={disabled}
                value={toLocalDueDateInputValue(field.value ?? null)}
                onChange={(event) =>
                  field.onChange(dueDateFromInputValue(event.target.value))
                }
              />
            </FormControl>
            <FormDescription>{t('signalFormDueDateHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <section
        className="flex flex-col gap-6 border-t border-border pt-6"
        data-signal-field="indicativePayouts"
      >
        <Skeleton loading={isLoadingTokens} width="100%" height={90}>
          <TokenPayoutFieldArray
            tokens={tokens}
            name="indicativePayouts"
            label={t('indicativeTokens')}
            markRequired={false}
            isLoadingTokens={isLoadingTokens}
          />
        </Skeleton>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('indicativeTokensHint')}
        </p>
      </section>
    </div>
  );
}
