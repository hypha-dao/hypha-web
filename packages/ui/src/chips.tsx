import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon, XCircle, ChevronDown, XIcon } from 'lucide-react';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { Button } from './button';
import { cn } from '@hypha-platform/ui-utils';
import { Badge } from './badge';
import { Separator } from './separator';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './command';

/**
 * Variants for the multi-select component to handle different styles.
 * Uses class-variance-authority (cva) to define different styles based on "variant" prop.
 */
const multiSelectVariants = cva('m-1', {
  variants: {
    variant: {
      default: 'border-foreground/10 text-foreground bg-card hover:bg-card/80',
      secondary:
        'border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80',
      destructive:
        'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
      inverted: 'inverted',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const TAG_USAGE_STORAGE_KEY = 'hypha:tag-picker-usage';

/**
 * Props for MultiSelect component
 */
interface MultiSelectProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
  /**
   * An array of option objects to be displayed in the multi-select component.
   * Each option object has a label, value, and an optional icon.
   */
  options: {
    /** The text to display for the option. */
    label: string;
    /** The unique value associated with the option. */
    value: string;
    /** Optional icon component to display alongside the option. */
    icon?: React.ComponentType<{ className?: string }>;
    /**
     * Optional row kind for grouped lists.
     * - option: selectable row (default)
     * - heading: non-selectable section title
     * - separator: non-selectable visual divider
     */
    kind?: 'option' | 'heading' | 'separator';
  }[];

  /**
   * Callback function triggered when the selected values change.
   * Receives an array of the new selected values.
   */
  onValueChange: (value: string[]) => void;

  /** The default selected values when the component mounts. */
  defaultValue?: string[];

  /**
   * Placeholder text to be displayed when no values are selected.
   * Optional, defaults to "Select options".
   */
  placeholder?: string;

  /**
   * Placeholder text shown in the dropdown search input.
   * Optional, defaults to "Search...".
   */
  searchPlaceholder?: string;

  /**
   * Animation duration in seconds for the visual effects (e.g., bouncing badges).
   * Optional, defaults to 0 (no animation).
   */
  animation?: number;

  /**
   * Maximum number of items to display. Extra selected items will be summarized.
   * Optional, defaults to 3.
   */
  maxCount?: number;

  /**
   * The modality of the popover. When set to true, interaction with outside elements
   * will be disabled and only popover content will be visible to screen readers.
   * Optional, defaults to false.
   */
  modalPopover?: boolean;

  /**
   * If true, renders the multi-select component as a child of another component.
   * Optional, defaults to false.
   */
  asChild?: boolean;

  /**
   * Selected passed into selector
   */
  value?: string[];

  /**
   * Controls whether the "Select All" option is displayed in the dropdown.
   * Optional, defaults to true.
   */
  allowToggleAll?: boolean;

  /**
   * Controls whether users can create options that are not in `options`.
   * Optional, defaults to false.
   */
  allowCreate?: boolean;

  /**
   * Visual style of the dropdown list.
   * - default: checkbox-style multi-select rows
   * - tag-picker: cleaner tag rows with trailing selected indicator
   */
  uiStyle?: 'default' | 'tag-picker';

  /**
   * Additional class names to apply custom styles to the multi-select component.
   * Optional, can be used to add custom styles.
   */
  className?: string;

  /**
   * Optional copy overrides for UI text.
   */
  labels?: {
    more?: (count: number) => string;
    noRecentTags?: string;
    noResults?: string;
    mostUsed?: string;
    create?: (term: string) => string;
    clear?: string;
    close?: string;
  };
}

const DEFAULT_MULTISELECT_LABELS = {
  more: (count: number) => `+ ${count} more`,
  noRecentTags: 'No recent tags yet. Start typing to search tags.',
  noResults: 'No results found.',
  mostUsed: '--- Most used tags ---',
  create: (term: string) => `Create "${term}"`,
  clear: 'Clear',
  close: 'Close',
} as const;

function isOptionDelimiter(option: { value: string; kind?: string }): boolean {
  if (option.kind === 'separator') return true;
  return option.value.length === 0 || option.value === '---';
}

function isOptionHeading(option: {
  kind?: string;
}): option is { kind: 'heading' } {
  return option.kind === 'heading';
}

function arraysShallowEqual(
  arr1: readonly string[],
  arr2: readonly string[],
): boolean {
  if (arr1 === arr2) return true;
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

export const MultiSelect = React.forwardRef<
  HTMLButtonElement,
  MultiSelectProps
>(
  (
    {
      options = [],
      onValueChange,
      variant,
      defaultValue = [],
      placeholder = 'Select options',
      searchPlaceholder = 'Search...',
      animation = 0,
      maxCount = 3,
      modalPopover = false,
      asChild = false,
      value,
      allowToggleAll = true,
      allowCreate = false,
      uiStyle = 'default',
      className,
      labels,
      ...props
    },
    ref,
  ) => {
    const MAX_TAG_PICKER_RESULTS = 8;
    const [selectedValues, setSelectedValues] =
      React.useState<string[]>(defaultValue);
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState('');
    const [tagUsageMap, setTagUsageMap] = React.useState<
      Record<string, number>
    >({});
    const trimmedSearchValue = searchValue.trim();
    const popoverContentRef = React.useRef<HTMLDivElement>(null);
    const listboxId = React.useId();
    const resolvedLabels = {
      ...DEFAULT_MULTISELECT_LABELS,
      ...(labels ?? {}),
    };
    const tagInputRef = React.useRef<HTMLInputElement>(null);
    const setTagInputRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        tagInputRef.current = node;
        if (!ref) return;
        const castedRef = ref as
          | React.Ref<HTMLInputElement>
          | React.Ref<HTMLButtonElement>;
        if (typeof castedRef === 'function') {
          castedRef(node as never);
          return;
        }
        if (castedRef && 'current' in castedRef) {
          (
            castedRef as React.MutableRefObject<
              HTMLInputElement | HTMLButtonElement | null
            >
          ).current = node;
        }
      },
      [ref],
    );

    React.useEffect(() => {
      if (value === undefined) return;
      const next = Array.isArray(value) ? (value as string[]) : [];
      setSelectedValues((prev) =>
        arraysShallowEqual(prev, next) ? prev : next,
      );
    }, [value]);

    React.useEffect(() => {
      if (uiStyle !== 'tag-picker') return;
      if (typeof window === 'undefined') return;
      try {
        const raw = window.localStorage.getItem(TAG_USAGE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setTagUsageMap(parsed as Record<string, number>);
        }
      } catch {
        // Ignore malformed local storage data.
      }
    }, [uiStyle]);

    const bumpTagUsage = React.useCallback(
      (tag: string) => {
        if (uiStyle !== 'tag-picker') return;
        if (!tag.trim()) return;
        const key = tag.trim().toLowerCase();
        setTagUsageMap((prev) => {
          const next = { ...prev, [key]: (prev[key] ?? 0) + 1 };
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(
                TAG_USAGE_STORAGE_KEY,
                JSON.stringify(next),
              );
            } catch {
              // Ignore storage write failures.
            }
          }
          return next;
        });
      },
      [uiStyle],
    );
    const toggleOption = (option: string) => {
      const isRemoving = selectedValues.includes(option);
      const newSelectedValues = isRemoving
        ? selectedValues.filter((value) => value !== option)
        : [...selectedValues, option];
      setSelectedValues(newSelectedValues);
      onValueChange(newSelectedValues);
      if (!isRemoving) {
        bumpTagUsage(option);
      }
      setSearchValue('');
    };

    const canCreateOption = React.useMemo(() => {
      const term = searchValue.trim();
      if (!allowCreate || term.length === 0) return false;
      const termLower = term.toLowerCase();
      const selectableOptions = options.filter(
        (option) =>
          !isOptionDelimiter(option) &&
          !isOptionHeading(option) &&
          option.kind !== 'separator',
      );
      const notInOptions = !selectableOptions.some(
        (option) =>
          option.value.toLowerCase() === termLower ||
          option.label.toLowerCase() === termLower,
      );
      const notAlreadySelected = !selectedValues.some(
        (selectedValue) => selectedValue.toLowerCase() === termLower,
      );
      return notInOptions && notAlreadySelected;
    }, [allowCreate, options, searchValue, selectedValues]);

    const handleClear = () => {
      setSelectedValues([]);
      onValueChange([]);
    };

    const handleTogglePopover = () => {
      setIsPopoverOpen((prev) => !prev);
    };

    const clearExtraOptions = () => {
      const newSelectedValues = selectedValues.slice(0, maxCount);
      setSelectedValues(newSelectedValues);
      onValueChange(newSelectedValues);
    };

    const toggleAll = () => {
      const selectableValues = options
        .filter(
          (option) =>
            !isOptionDelimiter(option) &&
            !isOptionHeading(option) &&
            option.kind !== 'separator',
        )
        .map((option) => option.value);
      if (selectedValues.length === selectableValues.length) {
        handleClear();
      } else {
        setSelectedValues(selectableValues);
        onValueChange(selectableValues);
      }
    };
    const getRankedOptions = React.useCallback(
      (term: string) => {
        const selectableOptions = options.filter(
          (option) =>
            !isOptionDelimiter(option) &&
            !isOptionHeading(option) &&
            option.kind !== 'separator',
        );
        const normalizedTerm = term.trim().toLowerCase();
        if (!normalizedTerm) {
          if (uiStyle !== 'tag-picker') {
            return selectableOptions;
          }
          const rankedByUsage = [...selectableOptions]
            .map((option) => ({
              option,
              usage: tagUsageMap[option.value.toLowerCase()] ?? 0,
            }))
            .filter(({ usage }) => usage > 0)
            .sort((a, b) => {
              if (a.usage !== b.usage) return b.usage - a.usage;
              return a.option.label.localeCompare(b.option.label);
            })
            .map(({ option }) => option);
          return rankedByUsage.slice(0, MAX_TAG_PICKER_RESULTS);
        }

        const startsWithMatches: typeof selectableOptions = [];
        const containsMatches: typeof selectableOptions = [];
        for (const option of selectableOptions) {
          const valueLower = option.value.toLowerCase();
          const labelLower = option.label.toLowerCase();
          const startsWith =
            valueLower.startsWith(normalizedTerm) ||
            labelLower.startsWith(normalizedTerm);
          if (startsWith) {
            startsWithMatches.push(option);
            continue;
          }
          const contains =
            valueLower.includes(normalizedTerm) ||
            labelLower.includes(normalizedTerm);
          if (contains) {
            containsMatches.push(option);
          }
        }

        const ranked = [...startsWithMatches, ...containsMatches];
        return uiStyle === 'tag-picker'
          ? ranked.slice(0, MAX_TAG_PICKER_RESULTS)
          : ranked;
      },
      [options, tagUsageMap, uiStyle],
    );

    const filteredOptions = React.useMemo(() => {
      return getRankedOptions(trimmedSearchValue);
    }, [getRankedOptions, trimmedSearchValue]);
    const groupedFilteredTagPickerOptions = React.useMemo(() => {
      if (uiStyle !== 'tag-picker' || trimmedSearchValue.length === 0)
        return [];
      const rankedValues = new Set(
        filteredOptions.map((option) => option.value),
      );
      if (rankedValues.size === 0) return [];

      const groupedRows: Array<
        (typeof options)[number] & { __renderKind?: 'heading' | 'option' }
      > = [];
      let currentHeading: (typeof options)[number] | null = null;
      let currentOptions: (typeof options)[number][] = [];

      const flushCategory = () => {
        if (!currentHeading || currentOptions.length === 0) return;
        groupedRows.push({ ...currentHeading, __renderKind: 'heading' });
        groupedRows.push(
          ...currentOptions.map((option) => ({
            ...option,
            __renderKind: 'option' as const,
          })),
        );
      };

      for (const option of options) {
        if (isOptionHeading(option)) {
          flushCategory();
          currentHeading = option;
          currentOptions = [];
          continue;
        }

        if (isOptionDelimiter(option) || option.kind === 'separator') {
          flushCategory();
          currentHeading = null;
          currentOptions = [];
          continue;
        }

        if (!rankedValues.has(option.value)) continue;

        if (!currentHeading) {
          groupedRows.push({ ...option, __renderKind: 'option' });
          continue;
        }
        currentOptions.push(option);
      }

      flushCategory();
      return groupedRows;
    }, [filteredOptions, options, trimmedSearchValue, uiStyle]);
    const groupedTagPickerOptions = React.useMemo(() => {
      if (uiStyle !== 'tag-picker' || trimmedSearchValue.length > 0) return [];
      return options;
    }, [options, trimmedSearchValue, uiStyle]);
    const shouldShowMostUsedHeading =
      uiStyle === 'tag-picker' &&
      trimmedSearchValue.length === 0 &&
      filteredOptions.length > 0;

    const focusCommandItem = React.useCallback(
      (direction: 'first' | 'last') => {
        const listRoot = popoverContentRef.current;
        if (!listRoot) return;
        const commandItems = Array.from(
          listRoot.querySelectorAll<HTMLElement>('[cmdk-item]'),
        ).filter((item) => item.getAttribute('aria-disabled') !== 'true');
        if (commandItems.length === 0) return;
        const target =
          direction === 'last'
            ? commandItems[commandItems.length - 1]
            : commandItems[0];
        target?.focus();
      },
      [],
    );

    const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
      if (event.key === 'Enter') {
        const term = event.currentTarget.value.trim();
        if (canCreateOption && term.length > 0) {
          event.preventDefault();
          toggleOption(term);
          return;
        }
        if (uiStyle === 'tag-picker') {
          event.preventDefault();
          if (term.length === 0) {
            return;
          }
          const topMatch = getRankedOptions(term)[0];
          if (topMatch) {
            toggleOption(topMatch.value);
          }
          return;
        }
        setIsPopoverOpen(true);
        return;
      }
      if (event.key === 'ArrowDown' && uiStyle === 'tag-picker') {
        event.preventDefault();
        if (!isPopoverOpen) {
          if (trimmedSearchValue.length === 0) return;
          setIsPopoverOpen(true);
          requestAnimationFrame(() => focusCommandItem('first'));
          return;
        }
        focusCommandItem('first');
        return;
      }
      if (event.key === 'ArrowUp' && uiStyle === 'tag-picker') {
        event.preventDefault();
        if (!isPopoverOpen) {
          if (trimmedSearchValue.length === 0) return;
          setIsPopoverOpen(true);
          requestAnimationFrame(() => focusCommandItem('last'));
          return;
        }
        focusCommandItem('last');
        return;
      }
      if (event.key === 'Backspace' && !event.currentTarget.value) {
        const newSelectedValues = [...selectedValues];
        newSelectedValues.pop();
        setSelectedValues(newSelectedValues);
        onValueChange(newSelectedValues);
      }
    };

    return (
      <Popover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        modal={modalPopover}
      >
        {uiStyle === 'tag-picker' ? (
          <PopoverAnchor asChild>
            <div
              role="group"
              aria-labelledby={props['aria-labelledby']}
              aria-label={
                props['aria-label'] ??
                (props['aria-labelledby'] ? undefined : placeholder)
              }
              className={cn(
                'flex w-full min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-0.5 text-sm ring-offset-background',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                className,
              )}
              onClick={() => {
                tagInputRef.current?.focus();
                setIsPopoverOpen(true);
              }}
            >
              {selectedValues.slice(0, maxCount).map((value) => {
                const option = options.find((o) => o.value === value);
                return (
                  <Badge
                    key={value}
                    className={cn(
                      multiSelectVariants({ variant }),
                      'rounded-full border-neutral-7 bg-neutral-3 text-neutral-12',
                    )}
                    style={{ animationDuration: `${animation}s` }}
                  >
                    <span className="text-neutral-10">#</span>
                    <span>{option?.label ?? value}</span>
                    <XCircle
                      className="ml-1 h-4 w-4 cursor-pointer text-neutral-10 hover:text-neutral-12"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleOption(value);
                      }}
                    />
                  </Badge>
                );
              })}
              {selectedValues.length > maxCount ? (
                <Badge
                  className={cn(
                    'rounded-full bg-transparent text-foreground border-foreground/1 hover:bg-transparent',
                    multiSelectVariants({ variant }),
                  )}
                  style={{ animationDuration: `${animation}s` }}
                >
                  {resolvedLabels.more(selectedValues.length - maxCount)}
                  <XCircle
                    className="ml-2 h-4 w-4 cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      clearExtraOptions();
                    }}
                  />
                </Badge>
              ) : null}
              <input
                ref={setTagInputRefs}
                id={props.id}
                name={props.name}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={isPopoverOpen}
                aria-controls={listboxId}
                aria-invalid={props['aria-invalid']}
                aria-describedby={props['aria-describedby']}
                aria-labelledby={props['aria-labelledby']}
                onBlur={(event) => {
                  props.onBlur?.(
                    event as unknown as React.FocusEvent<HTMLButtonElement>,
                  );
                }}
                value={searchValue}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  const nextTrimmedValue = nextValue.trim();
                  setSearchValue(nextValue);
                  if (nextTrimmedValue.length === 0) {
                    setIsPopoverOpen(true);
                    return;
                  }
                  if (!isPopoverOpen) setIsPopoverOpen(true);
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={(event) => {
                  props.onFocus?.(
                    event as unknown as React.FocusEvent<HTMLButtonElement>,
                  );
                  setIsPopoverOpen(true);
                }}
                placeholder={searchPlaceholder}
                className="min-w-[12ch] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                disabled={props.disabled}
              />
            </div>
          </PopoverAnchor>
        ) : (
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              colorVariant="neutral"
              ref={ref}
              {...props}
              onClick={handleTogglePopover}
              className={cn(
                'flex w-full p-1 rounded-md border min-h-11 h-auto items-center justify-between [&_svg]:pointer-events-auto',
                className,
              )}
            >
              {selectedValues.length > 0 ? (
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-wrap items-center">
                    {selectedValues.slice(0, maxCount).map((value) => {
                      const option = options.find((o) => o.value === value);
                      const IconComponent = option?.icon;
                      return (
                        <Badge
                          key={value}
                          className={cn(multiSelectVariants({ variant }))}
                          style={{ animationDuration: `${animation}s` }}
                        >
                          {IconComponent && (
                            <IconComponent className="h-4 w-4 mr-2" />
                          )}
                          {option?.label ?? value}
                          <XCircle
                            className="ml-2 h-4 w-4 cursor-pointer"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleOption(value);
                            }}
                          />
                        </Badge>
                      );
                    })}
                    {selectedValues.length > maxCount && (
                      <Badge
                        className={cn(
                          'bg-transparent text-foreground border-foreground/1 hover:bg-transparent',
                          multiSelectVariants({ variant }),
                        )}
                        style={{ animationDuration: `${animation}s` }}
                      >
                        {`+ ${selectedValues.length - maxCount} more`}
                        <XCircle
                          className="ml-2 h-4 w-4 cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            clearExtraOptions();
                          }}
                        />
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <XIcon
                      className="h-4 mx-2 cursor-pointer text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleClear();
                      }}
                    />
                    <Separator
                      orientation="vertical"
                      className="flex min-h-6 h-full"
                    />
                    <ChevronDown className="h-4 mx-2 cursor-pointer text-muted-foreground" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full mx-auto">
                  <span className="text-sm text-muted-foreground mx-3">
                    {placeholder}
                  </span>
                  <ChevronDown className="h-4 cursor-pointer text-muted-foreground mx-2" />
                </div>
              )}
            </Button>
          </PopoverTrigger>
        )}
        <PopoverContent
          ref={popoverContentRef}
          id={listboxId}
          role="listbox"
          className={cn(
            uiStyle === 'tag-picker'
              ? 'w-[var(--radix-popover-anchor-width,var(--radix-popover-trigger-width))] p-0'
              : 'w-[var(--radix-popover-trigger-width)] p-0',
          )}
          align="start"
          onOpenAutoFocus={(event) => {
            if (uiStyle === 'tag-picker') event.preventDefault();
          }}
          onEscapeKeyDown={() => setIsPopoverOpen(false)}
        >
          <Command shouldFilter={false}>
            {uiStyle === 'default' ? (
              <CommandInput
                placeholder={searchPlaceholder}
                onKeyDown={handleInputKeyDown}
                value={searchValue}
                onValueChange={setSearchValue}
              />
            ) : null}
            <CommandList>
              <CommandEmpty>
                {uiStyle === 'tag-picker' && trimmedSearchValue.length === 0
                  ? resolvedLabels.noRecentTags
                  : resolvedLabels.noResults}
              </CommandEmpty>
              <CommandGroup>
                {shouldShowMostUsedHeading ? (
                  <div className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-[0.06em] text-muted-foreground/55">
                    <span className="text-muted-foreground/35">• </span>
                    <span>{resolvedLabels.mostUsed}</span>
                  </div>
                ) : null}
                {canCreateOption ? (
                  <>
                    <CommandItem
                      key={`create-${searchValue}`}
                      value={`create-${searchValue.trim().toLowerCase()}`}
                      onSelect={() => toggleOption(searchValue.trim())}
                      className="cursor-pointer"
                    >
                      <span>{resolvedLabels.create(searchValue.trim())}</span>
                    </CommandItem>
                    <CommandSeparator />
                  </>
                ) : null}
                {allowToggleAll && uiStyle !== 'tag-picker' && (
                  <>
                    <CommandItem
                      key="all"
                      onSelect={toggleAll}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          selectedValues.length === options.length
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible',
                        )}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </div>
                      <span>(Select All)</span>
                    </CommandItem>
                    <CommandSeparator />
                  </>
                )}
                {(trimmedSearchValue.length > 0 &&
                groupedFilteredTagPickerOptions.length > 0
                  ? groupedFilteredTagPickerOptions
                  : filteredOptions
                ).map((option, index) => {
                  if (
                    '__renderKind' in option &&
                    option.__renderKind === 'heading'
                  ) {
                    return (
                      <div
                        key={`typed-group-heading-${index}`}
                        className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-[0.06em] text-muted-foreground/55"
                      >
                        <span className="text-muted-foreground/35">• </span>
                        <span>{option.label}</span>
                      </div>
                    );
                  }
                  const isSelected = selectedValues.includes(option.value);
                  const isDelimiter = isOptionDelimiter(option);
                  return isDelimiter ? (
                    <CommandSeparator key={`sep-${index}`} />
                  ) : (
                    <CommandItem
                      key={`${option.value}-${index}`}
                      value={option.label}
                      onSelect={() => toggleOption(option.value)}
                      className={cn(
                        'cursor-pointer',
                        uiStyle === 'tag-picker' && 'py-2',
                      )}
                    >
                      {uiStyle === 'default' ? (
                        <div
                          className={cn(
                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'opacity-50 [&_svg]:invisible',
                          )}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </div>
                      ) : null}
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{option.label}</span>
                      {uiStyle === 'tag-picker' ? (
                        <CheckIcon
                          className={cn(
                            'h-4 w-4 text-accent-11',
                            isSelected ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      ) : null}
                    </CommandItem>
                  );
                })}
                {uiStyle === 'tag-picker' &&
                trimmedSearchValue.length === 0 &&
                groupedTagPickerOptions.length > 0 ? (
                  <>
                    {filteredOptions.length > 0 ? <CommandSeparator /> : null}
                    {groupedTagPickerOptions.map((option, index) => {
                      if (isOptionDelimiter(option)) {
                        return <CommandSeparator key={`group-sep-${index}`} />;
                      }
                      if (isOptionHeading(option)) {
                        return (
                          <div
                            key={`group-heading-${index}`}
                            className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-[0.06em] text-muted-foreground/55"
                          >
                            <span className="text-muted-foreground/35">• </span>
                            <span>{option.label}</span>
                          </div>
                        );
                      }
                      const isSelected = selectedValues.includes(option.value);
                      return (
                        <CommandItem
                          key={`group-option-${option.value}-${index}`}
                          value={option.label}
                          onSelect={() => toggleOption(option.value)}
                          className="cursor-pointer py-2"
                        >
                          {option.icon ? (
                            <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                          ) : null}
                          <span className="flex-1 truncate">
                            {option.label}
                          </span>
                          <CheckIcon
                            className={cn(
                              'h-4 w-4 text-accent-11',
                              isSelected ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                        </CommandItem>
                      );
                    })}
                  </>
                ) : null}
              </CommandGroup>
              {uiStyle === 'default' ? (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <div className="flex items-center justify-between">
                      {selectedValues.length > 0 && (
                        <>
                          <CommandItem
                            onSelect={handleClear}
                            className="flex-1 justify-center cursor-pointer"
                          >
                            {resolvedLabels.clear}
                          </CommandItem>
                          <Separator
                            orientation="vertical"
                            className="flex min-h-6 h-full"
                          />
                        </>
                      )}
                      <CommandItem
                        onSelect={() => setIsPopoverOpen(false)}
                        className="flex-1 justify-center cursor-pointer max-w-full"
                      >
                        {resolvedLabels.close}
                      </CommandItem>
                    </div>
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

MultiSelect.displayName = 'MultiSelect';
