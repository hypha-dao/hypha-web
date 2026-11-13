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
  MultiSelect,
  RequirementMark,
  Skeleton,
  Switch,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_TAGS,
  collectExistingTags,
  parseCapitalKeys,
  useFindCoherences,
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
 * TODO: Temporary for Reciprocal Exchange. Delete this folder, and the
 * insertion points in `create-signal-form.tsx` and `signal-page.tsx`, when
 * Reciprocal Exchange no longer reads these columns.
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
  const { coherences: spaceSignals } = useFindCoherences({
    spaceSlug,
    includeArchived: true,
  });
  const existingBoardTags = React.useMemo(
    () =>
      collectExistingTags((spaceSignals ?? []).map((signal) => signal.tags)),
    [spaceSignals],
  );
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
  const tagOptions = React.useMemo(
    () => signalTagOptions(t, existingBoardTags),
    [existingBoardTags, t],
  );

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
        name="tags"
        render={({ field }) => (
          <FormItem className="border-t border-border pt-6">
            <FormLabel className="text-foreground">{t('tags')}</FormLabel>
            <FormControl>
              <MultiSelect
                placeholder={t('selectOneOrMore')}
                searchPlaceholder={
                  t.has('searchOrCreateTag')
                    ? t('searchOrCreateTag')
                    : 'Type to search or create a tag'
                }
                options={tagOptions}
                value={field.value}
                allowToggleAll={false}
                allowCreate={true}
                maxCount={2}
                uiStyle="tag-picker"
                labels={{
                  more: (count) =>
                    t.has('tagsMore' as never)
                      ? `${t('tagsMore' as never)} ${count}`
                      : `+ ${count} more`,
                  noRecentTags: t.has('noRecentTags' as never)
                    ? t('noRecentTags' as never)
                    : 'No recent tags yet. Start typing to search tags.',
                  noResults: t.has('noResults' as never)
                    ? t('noResults' as never)
                    : 'No results found.',
                  mostUsed: t.has('mostUsedTagsHeading' as never)
                    ? t('mostUsedTagsHeading' as never)
                    : '--- Most used tags ---',
                  create: (term) =>
                    t.has('createTag' as never)
                      ? `${t('createTag' as never)} "${term}"`
                      : `Create "${term}"`,
                  clear: t.has('clear' as never)
                    ? t('clear' as never)
                    : 'Clear',
                  close: t.has('close' as never)
                    ? t('close' as never)
                    : 'Close',
                }}
                onValueChange={field.onChange}
              />
            </FormControl>
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

type TagOptionRow = {
  value: string;
  label: string;
  kind: 'option' | 'heading' | 'separator';
};

function signalTagOptions(
  t: ReturnType<typeof useTranslations<'CoherenceTab'>>,
  existingBoardTags: string[],
): TagOptionRow[] {
  const labelFor = (tag: string) =>
    t.has(`tagLabels.${tag}` as never) ? t(`tagLabels.${tag}` as never) : tag;
  const categoryLabelFor = (key: string, fallback: string) =>
    t.has(`tagCategories.${key}` as never)
      ? t(`tagCategories.${key}` as never)
      : fallback;

  const tagsByCategory: Array<{ title: string; tags: readonly string[] }> = [
    {
      title: categoryLabelFor('purposeDirection', 'Purpose & Direction'),
      tags: [
        'Purpose',
        'North Star',
        'Vision',
        'Strategy',
        'Values',
        'Principles',
        'Milestones',
        'Impact Goals',
      ],
    },
    {
      title: categoryLabelFor('broaderContext', 'Broader Context'),
      tags: [
        'Trend',
        'Social Conditions',
        'Planetary Boundaries',
        'Policy',
        'Regulation',
        'Emergency Response',
      ],
    },
    {
      title: categoryLabelFor('peopleRoles', 'People & Roles'),
      tags: [
        'Project',
        'Quest',
        'Job',
        'Skill',
        'Advisory Support',
        'Volunteering',
      ],
    },
    {
      title: categoryLabelFor('ecosystemMapping', 'Ecosystem Mapping'),
      tags: [
        'Serving Audience',
        'Customers',
        'Users',
        'Communities',
        'Beneficiaries',
        'Partners',
      ],
    },
    {
      title: categoryLabelFor('operatingCoherence', 'Operating Coherence'),
      tags: [
        'Governance',
        'Processes',
        'Structure',
        'Rhythms',
        'Support Systems',
      ],
    },
    {
      title: categoryLabelFor('needsResources', 'Needs & Resources'),
      tags: ['Needs', 'Resources', 'Fundraising', 'Matchmaking'],
    },
    {
      title: categoryLabelFor('valueModel', 'Value & Model'),
      tags: [
        'Innovation',
        'Products',
        'Services',
        'Product-Market Fit',
        'Business Model',
        'Data',
        'Knowledge',
        'Intellectual Property',
      ],
    },
    {
      title: categoryLabelFor('evidenceImpact', 'Evidence & Impact'),
      tags: ['Proof of Action', 'Proof of Impact', 'Learning', 'Feedback Loop'],
    },
  ];

  const canonicalTags = new Set(COHERENCE_TAGS as readonly string[]);
  const grouped = tagsByCategory.flatMap((category, categoryIndex) => {
    const rows: TagOptionRow[] = [
      {
        value: `__heading__${categoryIndex}`,
        label: category.title,
        kind: 'heading',
      },
      ...category.tags
        .filter((tag) => canonicalTags.has(tag))
        .map((tag) => ({
          value: tag,
          label: labelFor(tag),
          kind: 'option' as const,
        })),
    ];
    if (categoryIndex < tagsByCategory.length - 1) {
      rows.push({
        value: `__separator__${categoryIndex}`,
        label: '',
        kind: 'separator',
      });
    }
    return rows;
  });

  const usedOnBoard = existingBoardTags.filter(
    (tag) => !canonicalTags.has(tag),
  );
  if (usedOnBoard.length === 0) return grouped;
  return [
    {
      value: '__heading__board',
      label: t('usedOnThisBoard'),
      kind: 'heading',
    },
    ...usedOnBoard.map((tag) => ({
      value: tag,
      label: tag,
      kind: 'option' as const,
    })),
    {
      value: '__separator__board',
      label: '',
      kind: 'separator',
    },
    ...grouped,
  ];
}
