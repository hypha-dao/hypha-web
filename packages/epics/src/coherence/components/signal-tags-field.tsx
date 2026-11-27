'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MultiSelect,
} from '@hypha-platform/ui';
import {
  COHERENCE_TAGS,
  collectExistingTags,
  useFindCoherences,
  type SignalFormValues,
} from '@hypha-platform/core/client';

/**
 * Tags on a signal: the free categorization people group and filter signals
 * by (#2764). Suggests the built-in tag list by category, with the tags this
 * space already uses on top, and lets people create new ones.
 */
export function SignalTagsField({ disabled = false }: { disabled?: boolean }) {
  const form = useFormContext<SignalFormValues>();
  const params = useParams<{ id?: string }>();
  const spaceSlug = typeof params?.id === 'string' ? params.id.trim() : '';
  const t = useTranslations('CoherenceTab');
  const { coherences: spaceSignals } = useFindCoherences({
    spaceSlug,
    includeArchived: true,
  });
  const existingSpaceTags = React.useMemo(
    () =>
      collectExistingTags((spaceSignals ?? []).map((signal) => signal.tags)),
    [spaceSignals],
  );
  const tagOptions = React.useMemo(
    () => signalTagOptions(t, existingSpaceTags),
    [existingSpaceTags, t],
  );

  return (
    <FormField
      control={form.control}
      name="tags"
      render={({ field }) => (
        <FormItem data-signal-field="tags">
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
              disabled={disabled}
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
                clear: t.has('clear' as never) ? t('clear' as never) : 'Clear',
                close: t.has('close' as never) ? t('close' as never) : 'Close',
              }}
              onValueChange={field.onChange}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

type TagOptionRow = {
  value: string;
  label: string;
  kind: 'option' | 'heading' | 'separator';
};

export function signalTagOptions(
  t: ReturnType<typeof useTranslations<'CoherenceTab'>>,
  existingSpaceTags: string[],
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

  const usedOnBoard = existingSpaceTags.filter(
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
