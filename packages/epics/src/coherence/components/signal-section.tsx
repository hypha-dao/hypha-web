'use client';

import { FC, ReactNode } from 'react';
import { Text } from '@radix-ui/themes';
import { useSignalsSection } from '../hooks';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SectionLoadMore,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import { Empty } from '../../common';
import { SignalGrid } from './signal-grid';
import {
  COHERENCE_TAGS,
  Coherence,
  DirectionType,
  useMe,
} from '@hypha-platform/core/client';
import { PlusIcon } from '@radix-ui/react-icons';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Archive, Pencil, SearchIcon } from 'lucide-react';
import { useSpaceMember } from '../../spaces/hooks/use-space-member';
import {
  SIGNAL_PROVISIONING_NOTICE_EVENT,
  SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
} from '../constants';

const SIGNAL_PROVISIONING_NOTICE_AUTO_DISMISS_MS = 8000;
const SIGNAL_BOARDS_STORAGE_KEY_PREFIX = 'hypha-signal-boards-v1-';

type BoardFilterKind = 'category' | 'tag';

type SignalBoard = {
  id: string;
  name: string;
  filterKind: BoardFilterKind;
  filterValues: string[];
  createdByPersonId: number | null;
  archived: boolean;
};

type SignalTagCategory = {
  key: string;
  fallbackLabel: string;
  tags: readonly string[];
};

const SIGNAL_TAG_CATEGORIES: readonly SignalTagCategory[] = [
  {
    key: 'purposeDirection',
    fallbackLabel: 'Purpose & Direction',
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
    key: 'broaderContext',
    fallbackLabel: 'Broader Context',
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
    key: 'peopleRoles',
    fallbackLabel: 'People & Roles',
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
    key: 'ecosystemMapping',
    fallbackLabel: 'Ecosystem Mapping',
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
    key: 'operatingCoherence',
    fallbackLabel: 'Operating Coherence',
    tags: [
      'Governance',
      'Processes',
      'Structure',
      'Rhythms',
      'Support Systems',
    ],
  },
  {
    key: 'needsResources',
    fallbackLabel: 'Needs & Resources',
    tags: ['Needs', 'Resources', 'Fundraising', 'Matchmaking'],
  },
  {
    key: 'valueModel',
    fallbackLabel: 'Value & Model',
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
    key: 'evidenceImpact',
    fallbackLabel: 'Evidence & Impact',
    tags: ['Proof of Action', 'Proof of Impact', 'Learning', 'Feedback Loop'],
  },
];

type SignalSectionProps = {
  basePath: string;
  web3SpaceId: number;
  signals: Coherence[];
  leadImage?: string;
  toolbarLeft?: ReactNode;
  isLoading: boolean;
  firstPageSize?: number;
  pageSize?: number;
  hideArchived: boolean;
  setHideArchived: (checked: boolean) => void;
  order?: string;
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
};

export const SignalSection: FC<SignalSectionProps> = ({
  basePath,
  web3SpaceId,
  signals,
  leadImage,
  toolbarLeft,
  isLoading,
  firstPageSize = 10,
  pageSize = 10,
  hideArchived,
  setHideArchived,
  refresh,
  onSignalClick,
}) => {
  const t = useTranslations('CoherenceTab');
  const { person } = useMe();
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const [boards, setBoards] = React.useState<SignalBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = React.useState<string>('');
  const [createBoardOpen, setCreateBoardOpen] = React.useState(false);
  const [editingBoardId, setEditingBoardId] = React.useState<string | null>(
    null,
  );
  const [newBoardName, setNewBoardName] = React.useState('');
  const [newBoardFilterKind, setNewBoardFilterKind] =
    React.useState<BoardFilterKind>('category');
  const [newBoardCategory, setNewBoardCategory] = React.useState(
    SIGNAL_TAG_CATEGORIES[0]?.key ?? '',
  );
  const [newBoardTag, setNewBoardTag] = React.useState<string[]>([]);
  const [provisioningNoticeLines, setProvisioningNoticeLines] = React.useState<
    string[]
  >([]);

  const readProvisioningNotice = React.useCallback(() => {
    const rawNotice = sessionStorage.getItem(
      SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
    );
    if (!rawNotice) return;
    sessionStorage.removeItem(SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY);
    try {
      const parsed = JSON.parse(rawNotice);
      if (!Array.isArray(parsed)) return;
      const lines = parsed.filter(
        (line): line is string =>
          typeof line === 'string' && line.trim().length > 0,
      );
      if (lines.length > 0) setProvisioningNoticeLines(lines);
    } catch (error) {
      console.warn('Failed to parse signal provisioning notice:', error);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    readProvisioningNotice();
    window.addEventListener(
      SIGNAL_PROVISIONING_NOTICE_EVENT,
      readProvisioningNotice,
    );
    return () =>
      window.removeEventListener(
        SIGNAL_PROVISIONING_NOTICE_EVENT,
        readProvisioningNotice,
      );
  }, [readProvisioningNotice]);

  React.useEffect(() => {
    if (provisioningNoticeLines.length === 0) return;
    const timeoutId = window.setTimeout(() => {
      setProvisioningNoticeLines([]);
    }, SIGNAL_PROVISIONING_NOTICE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeoutId);
  }, [provisioningNoticeLines]);

  const createSignalHref = `/${lang}/dho/${id}/coherence/new-signal`;
  const { isMember, isMemberLoading } = useSpaceMember({
    spaceId: web3SpaceId,
  });
  const boardStorageKey = React.useMemo(
    () => `${SIGNAL_BOARDS_STORAGE_KEY_PREFIX}${id}`,
    [id],
  );

  const tagLabelFor = React.useCallback(
    (tag: string) =>
      t.has(`tagLabels.${tag}` as never) ? t(`tagLabels.${tag}` as never) : tag,
    [t],
  );

  const categoryOptions = React.useMemo(
    () =>
      SIGNAL_TAG_CATEGORIES.map((category) => ({
        value: category.key,
        label: t.has(`tagCategories.${category.key}` as never)
          ? t(`tagCategories.${category.key}` as never)
          : category.fallbackLabel,
      })),
    [t],
  );

  const tagOptions = React.useMemo(() => {
    type TagOptionRow = {
      value: string;
      label: string;
      kind: 'option' | 'heading' | 'separator';
    };

    const grouped = SIGNAL_TAG_CATEGORIES.flatMap((category, categoryIndex) => {
      const categoryLabel = t.has(`tagCategories.${category.key}` as never)
        ? t(`tagCategories.${category.key}` as never)
        : category.fallbackLabel;
      const rows: TagOptionRow[] = [
        {
          value: `__heading__${categoryIndex}`,
          label: categoryLabel,
          kind: 'heading',
        },
        ...category.tags
          .filter((tag) => (COHERENCE_TAGS as readonly string[]).includes(tag))
          .map((tag) => ({
            value: tag,
            label: tagLabelFor(tag),
            kind: 'option' as const,
          })),
      ];
      if (categoryIndex < SIGNAL_TAG_CATEGORIES.length - 1) {
        rows.push({
          value: `__separator__${categoryIndex}`,
          label: '',
          kind: 'separator',
        });
      }
      return rows;
    });
    return grouped;
  }, [t, tagLabelFor]);

  const categoryByKey = React.useMemo(
    () =>
      new Map<string, SignalTagCategory>(
        SIGNAL_TAG_CATEGORIES.map((category) => [category.key, category]),
      ),
    [],
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(boardStorageKey);
      if (!raw) {
        setBoards([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const next = parsed.filter(
        (
          item,
        ): item is {
          id: string;
          name: string;
          filterKind: BoardFilterKind;
          filterValues?: unknown;
          filterValue?: unknown;
          createdByPersonId?: unknown;
          archived?: unknown;
        } =>
          typeof item?.id === 'string' &&
          typeof item?.name === 'string' &&
          (item?.filterKind === 'category' || item?.filterKind === 'tag'),
      );
      const normalizedBoards: SignalBoard[] = next
        .map((item) => {
          const valuesRaw = Array.isArray(item.filterValues)
            ? item.filterValues
            : typeof item.filterValue === 'string'
            ? [item.filterValue]
            : [];
          const values = Array.from(
            new Set(
              valuesRaw
                .filter((entry): entry is string => typeof entry === 'string')
                .map((entry) => entry.trim())
                .filter(Boolean),
            ),
          );
          if (values.length === 0) return null;
          return {
            id: item.id,
            name: item.name,
            filterKind: item.filterKind,
            filterValues: values,
            createdByPersonId:
              typeof item.createdByPersonId === 'number'
                ? item.createdByPersonId
                : null,
            archived: item.archived === true,
          } as SignalBoard;
        })
        .filter((item): item is SignalBoard => item !== null);
      setBoards(normalizedBoards);
    } catch (error) {
      console.warn('Failed to load saved signal boards:', error);
    }
  }, [boardStorageKey]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(boardStorageKey, JSON.stringify(boards));
    } catch (error) {
      console.warn('Failed to persist saved signal boards:', error);
    }
  }, [boardStorageKey, boards]);

  React.useEffect(() => {
    if (!activeBoardId) return;
    if (
      !boards.some((board) => board.id === activeBoardId && !board.archived)
    ) {
      setActiveBoardId('');
    }
  }, [activeBoardId, boards]);

  const activeBoards = React.useMemo(
    () => boards.filter((board) => !board.archived),
    [boards],
  );

  const activeBoard = React.useMemo(
    () => activeBoards.find((board) => board.id === activeBoardId),
    [activeBoardId, activeBoards],
  );

  const filterSignalsByBoard = React.useCallback(
    (inputSignals: Coherence[], board: SignalBoard | undefined) => {
      if (!board) return inputSignals;
      if (board.filterKind === 'tag') {
        const selectedTagSet = new Set(board.filterValues);
        if (selectedTagSet.size === 0) return inputSignals;
        return inputSignals.filter((signal) =>
          (signal.tags ?? []).some((tag) => selectedTagSet.has(tag)),
        );
      }
      const categoryTags = board.filterValues.flatMap((categoryKey) => [
        ...(categoryByKey.get(categoryKey)?.tags ?? []),
      ]);
      if (!categoryTags.length) return inputSignals;
      const categoryTagSet = new Set(categoryTags);
      return inputSignals.filter((signal) =>
        (signal.tags ?? []).some((tag) => categoryTagSet.has(tag)),
      );
    },
    [categoryByKey],
  );

  const activeBoardTags = React.useMemo(() => {
    if (!activeBoard) return [] as string[];
    if (activeBoard.filterKind === 'tag') {
      return [...activeBoard.filterValues];
    }
    const mergedCategoryTags = activeBoard.filterValues.flatMap(
      (categoryKey) => [...(categoryByKey.get(categoryKey)?.tags ?? [])],
    );
    return Array.from(new Set(mergedCategoryTags));
  }, [activeBoard, categoryByKey]);

  const createSignalHrefWithBoard = React.useMemo(() => {
    if (!activeBoard || activeBoardTags.length === 0) {
      return createSignalHref;
    }
    const params = new URLSearchParams();
    params.set('fromBoardId', activeBoard.id);
    for (const tag of activeBoardTags) {
      params.append('boardTag', tag);
    }
    return `${createSignalHref}?${params.toString()}`;
  }, [activeBoard, activeBoardTags, createSignalHref]);

  const boardFilteredSignals = React.useMemo(() => {
    return filterSignalsByBoard(signals, activeBoard);
  }, [activeBoard, filterSignalsByBoard, signals]);

  const resetBoardForm = React.useCallback(() => {
    setEditingBoardId(null);
    setNewBoardName('');
    setNewBoardFilterKind('category');
    setNewBoardCategory(SIGNAL_TAG_CATEGORIES[0]?.key ?? '');
    setNewBoardTag([]);
  }, []);

  const handleSaveBoard = React.useCallback(() => {
    const name = newBoardName.trim();
    if (!name) return;
    const values =
      newBoardFilterKind === 'category' ? [newBoardCategory] : newBoardTag;
    const normalizedValues = Array.from(
      new Set(values.map((value) => value.trim()).filter(Boolean)),
    );
    if (normalizedValues.length === 0) return;
    if (editingBoardId) {
      setBoards((prev) =>
        prev.map((board) =>
          board.id === editingBoardId
            ? {
                ...board,
                name,
                filterKind: newBoardFilterKind,
                filterValues: normalizedValues,
              }
            : board,
        ),
      );
      setActiveBoardId(editingBoardId);
      setCreateBoardOpen(false);
      resetBoardForm();
      return;
    }
    const idValue = `board-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    setBoards((prev) => [
      ...prev,
      {
        id: idValue,
        name,
        filterKind: newBoardFilterKind,
        filterValues: normalizedValues,
        createdByPersonId: person?.id ?? null,
        archived: false,
      },
    ]);
    setActiveBoardId(idValue);
    setCreateBoardOpen(false);
    resetBoardForm();
  }, [
    editingBoardId,
    newBoardCategory,
    newBoardFilterKind,
    newBoardName,
    newBoardTag,
    person?.id,
    resetBoardForm,
  ]);

  const handleEditBoard = React.useCallback((board: SignalBoard) => {
    setEditingBoardId(board.id);
    setNewBoardName(board.name);
    setNewBoardFilterKind(board.filterKind);
    if (board.filterKind === 'category') {
      setNewBoardCategory(
        board.filterValues[0] ?? SIGNAL_TAG_CATEGORIES[0]?.key ?? '',
      );
      setNewBoardTag([]);
    } else {
      setNewBoardTag([...board.filterValues]);
    }
    setCreateBoardOpen(true);
  }, []);

  const handleArchiveBoard = React.useCallback(
    (boardId: string) => {
      setBoards((prev) =>
        prev.map((board) =>
          board.id === boardId ? { ...board, archived: true } : board,
        ),
      );
      if (activeBoardId === boardId) {
        setActiveBoardId('');
      }
    },
    [activeBoardId],
  );

  const {
    pages,
    loadMore,
    pagination,
    onUpdateSearch,
    searchTerm,
    filteredSignals,
  } = useSignalsSection({
    signals: boardFilteredSignals,
    firstPageSize,
    pageSize,
  });
  const searchFilteredSignals = React.useMemo(() => {
    const query = searchTerm?.trim()?.toLowerCase();
    if (!query) return signals;
    return signals.filter((sig) =>
      [sig.title, sig.description].some(
        (value) => value?.toLowerCase()?.includes(query) ?? false,
      ),
    );
  }, [searchTerm, signals]);
  const boardCountsById = React.useMemo(() => {
    const byId = new Map<string, number>();
    for (const board of activeBoards) {
      byId.set(
        board.id,
        filterSignalsByBoard(searchFilteredSignals, board).length,
      );
    }
    return byId;
  }, [activeBoards, filterSignalsByBoard, searchFilteredSignals]);
  const visibleSignals = React.useMemo(() => {
    const visibleCount =
      pages <= 1 ? firstPageSize : firstPageSize + (pages - 1) * pageSize;
    return filteredSignals.slice(0, visibleCount);
  }, [filteredSignals, firstPageSize, pageSize, pages]);

  return (
    <div className="flex w-full flex-col gap-4">
      {toolbarLeft || activeBoards.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {toolbarLeft}
          {activeBoards.length > 0 ? (
            <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
              <span className="text-1 font-medium text-muted-foreground">
                {t.has('boardFilters' as never)
                  ? t('boardFilters' as never)
                  : 'Boards'}
              </span>
              <Tabs value={activeBoardId} onValueChange={setActiveBoardId}>
                <TabsList triggerVariant="switch" className="w-fit">
                  <TabsTrigger value="" variant="switch">
                    {`${t('boardAll')} (${searchFilteredSignals.length})`}
                  </TabsTrigger>
                  {activeBoards.map((board) => (
                    <TabsTrigger
                      key={board.id}
                      value={board.id}
                      variant="switch"
                    >
                      {`${board.name} (${boardCountsById.get(board.id) ?? 0})`}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {activeBoard &&
              activeBoard.createdByPersonId != null &&
              person?.id === activeBoard.createdByPersonId ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    colorVariant="neutral"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleEditBoard(activeBoard)}
                    aria-label={
                      t.has('saveChanges' as never)
                        ? t('saveChanges' as never)
                        : 'Edit board'
                    }
                    title={
                      t.has('saveChanges' as never)
                        ? t('saveChanges' as never)
                        : 'Edit board'
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    colorVariant="neutral"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleArchiveBoard(activeBoard.id)}
                    aria-label={
                      t.has('boardArchive' as never)
                        ? t('boardArchive' as never)
                        : 'Archive board'
                    }
                    title={
                      t.has('boardArchive' as never)
                        ? t('boardArchive' as never)
                        : 'Archive board'
                    }
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          type="search"
          placeholder={t('searchSignals')}
          aria-label={t('searchSignals')}
          onChange={(event) => onUpdateSearch(event.target.value)}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="w-full lg:min-w-0 lg:flex-1"
        />
        <div className="flex w-full items-center justify-end lg:w-auto lg:shrink-0">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <div className="flex flex-row gap-2 h-full">
              <Checkbox
                id="hideArchivedSignalsCheckbox"
                className="self-center border-accent-8/80 data-[state=checked]:border-accent-9 data-[state=checked]:bg-accent-9 data-[state=checked]:text-accent-contrast focus-visible:ring-accent-8"
                checked={hideArchived}
                onCheckedChange={(value) => {
                  setHideArchived(value === true);
                }}
                disabled={isLoading}
              />
              <label
                className="text-[14px] self-center whitespace-nowrap"
                htmlFor="hideArchivedSignalsCheckbox"
              >
                {t('hideArchived')}
              </label>
            </div>
            <Button
              variant="outline"
              colorVariant="accent"
              className="w-auto"
              onClick={() => {
                resetBoardForm();
                setCreateBoardOpen(true);
              }}
            >
              {t('createBoard')}
            </Button>
            {!isMemberLoading && isMember ? (
              <Button
                asChild
                variant="default"
                colorVariant="accent"
                className="w-auto"
              >
                <Link href={createSignalHrefWithBoard}>
                  <PlusIcon />
                  {t('newSignal')}
                </Link>
              </Button>
            ) : (
              <Button
                variant="default"
                colorVariant="accent"
                disabled
                className="w-auto"
              >
                <PlusIcon />
                {t('newSignal')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Dialog
        open={createBoardOpen}
        onOpenChange={(open) => {
          setCreateBoardOpen(open);
          if (!open) resetBoardForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBoardId
                ? t.has('saveChanges' as never)
                  ? t('saveChanges' as never)
                  : 'Edit board'
                : t('createBoard')}
            </DialogTitle>
            <DialogDescription>
              {editingBoardId
                ? t.has('createBoardDescription' as never)
                  ? t('createBoardDescription' as never)
                  : 'Update this board filter.'
                : t('createBoardDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <label
                className="text-2 text-muted-foreground"
                htmlFor="boardNameInput"
              >
                {t('boardName')}
              </label>
              <Input
                id="boardNameInput"
                value={newBoardName}
                onChange={(event) => setNewBoardName(event.target.value)}
                placeholder={t('boardNamePlaceholder')}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-2 text-muted-foreground">
                {t('boardFilterBy')}
              </label>
              <Select
                value={newBoardFilterKind}
                onValueChange={(value) =>
                  setNewBoardFilterKind(value as BoardFilterKind)
                }
              >
                <SelectTrigger className="h-10 min-h-10 py-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">
                    {t('boardFilterCategory')}
                  </SelectItem>
                  <SelectItem value="tag">{t('boardFilterTag')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newBoardFilterKind === 'category' ? (
              <div className="grid gap-1.5">
                <label className="text-2 text-muted-foreground">
                  {t('boardSelectCategory')}
                </label>
                <Select
                  value={newBoardCategory}
                  onValueChange={setNewBoardCategory}
                >
                  <SelectTrigger className="h-10 min-h-10 py-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <label className="text-2 text-muted-foreground">
                  {t('boardSelectTag')}
                </label>
                <MultiSelect
                  placeholder={t('selectOneOrMore')}
                  searchPlaceholder={
                    t.has('searchOrCreateTag')
                      ? t('searchOrCreateTag')
                      : 'Type to search tags'
                  }
                  options={tagOptions}
                  value={newBoardTag}
                  allowToggleAll={false}
                  allowCreate={false}
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
                  onValueChange={setNewBoardTag}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              onClick={() => setCreateBoardOpen(false)}
            >
              {t('boardCancelAction')}
            </Button>
            <Button
              type="button"
              colorVariant="accent"
              onClick={handleSaveBoard}
              disabled={
                !newBoardName.trim() ||
                (newBoardFilterKind === 'tag' && newBoardTag.length === 0)
              }
            >
              {editingBoardId
                ? t.has('saveChanges' as never)
                  ? t('saveChanges' as never)
                  : 'Save changes'
                : t('boardCreateAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {provisioningNoticeLines.length > 0 ? (
        <ErrorAlert lines={provisioningNoticeLines} bgColor="bg-yellow-600" />
      ) : null}

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>{t('listIsEmpty')}</p>
        </Empty>
      ) : (
        <SignalGrid
          isLoading={false}
          basePath={basePath}
          leadImage={leadImage}
          signals={visibleSignals}
          refresh={refresh}
          onSignalClick={onSignalClick}
        />
      )}
      {pagination?.totalPages === 0 ||
      filteredSignals.length <= firstPageSize ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text className="line-clamp-3 max-w-md text-center text-sm leading-snug">
            {pagination?.totalPages === pages ? t('noMore') : t('loadMore')}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
