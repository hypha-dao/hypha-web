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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SectionLoadMore,
} from '@hypha-platform/ui';
import { Empty } from '../../common';
import { SignalGridContainer } from './signal-grid.container';
import {
  COHERENCE_TAGS,
  Coherence,
  DirectionType,
} from '@hypha-platform/core/client';
import { PlusIcon } from '@radix-ui/react-icons';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import React from 'react';
import { useTranslations } from 'next-intl';
import { SearchIcon, X } from 'lucide-react';
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
  filterValue: string;
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
    tags: ['Project', 'Quest', 'Job', 'Skill', 'Advisory Support', 'Volunteering'],
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
    tags: ['Governance', 'Processes', 'Structure', 'Rhythms', 'Support Systems'],
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
  firstPageSize = 4,
  pageSize = 4,
  hideArchived,
  setHideArchived,
  refresh,
  onSignalClick,
}) => {
  const t = useTranslations('CoherenceTab');
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const [boards, setBoards] = React.useState<SignalBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = React.useState<string>('all');
  const [createBoardOpen, setCreateBoardOpen] = React.useState(false);
  const [newBoardName, setNewBoardName] = React.useState('');
  const [newBoardFilterKind, setNewBoardFilterKind] =
    React.useState<BoardFilterKind>('category');
  const [newBoardCategory, setNewBoardCategory] = React.useState(
    SIGNAL_TAG_CATEGORIES[0]?.key ?? '',
  );
  const [newBoardTag, setNewBoardTag] = React.useState(
    COHERENCE_TAGS[0] ?? '',
  );
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
        (item): item is SignalBoard =>
          typeof item?.id === 'string' &&
          typeof item?.name === 'string' &&
          (item?.filterKind === 'category' || item?.filterKind === 'tag') &&
          typeof item?.filterValue === 'string',
      );
      setBoards(next);
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
    if (activeBoardId === 'all') return;
    if (!boards.some((board) => board.id === activeBoardId)) {
      setActiveBoardId('all');
    }
  }, [activeBoardId, boards]);

  const activeBoard = React.useMemo(
    () => boards.find((board) => board.id === activeBoardId),
    [activeBoardId, boards],
  );

  const activeBoardTags = React.useMemo(() => {
    if (!activeBoard) return [] as string[];
    if (activeBoard.filterKind === 'tag') return [activeBoard.filterValue];
    return [...(categoryByKey.get(activeBoard.filterValue)?.tags ?? [])];
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
    if (!activeBoard) return signals;
    if (activeBoard.filterKind === 'tag') {
      return signals.filter((signal) =>
        (signal.tags ?? []).includes(activeBoard.filterValue),
      );
    }
    const categoryTags =
      categoryByKey.get(activeBoard.filterValue)?.tags ?? ([] as string[]);
    if (!categoryTags.length) return signals;
    const categoryTagSet = new Set(categoryTags);
    return signals.filter((signal) =>
      (signal.tags ?? []).some((tag) => categoryTagSet.has(tag)),
    );
  }, [activeBoard, categoryByKey, signals]);

  const resetBoardForm = React.useCallback(() => {
    setNewBoardName('');
    setNewBoardFilterKind('category');
    setNewBoardCategory(SIGNAL_TAG_CATEGORIES[0]?.key ?? '');
    setNewBoardTag(COHERENCE_TAGS[0] ?? '');
  }, []);

  const handleCreateBoard = React.useCallback(() => {
    const name = newBoardName.trim();
    if (!name) return;
    const value =
      newBoardFilterKind === 'category' ? newBoardCategory : newBoardTag;
    if (!value) return;
    const idValue = `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setBoards((prev) => [
      ...prev,
      {
        id: idValue,
        name,
        filterKind: newBoardFilterKind,
        filterValue: value,
      },
    ]);
    setActiveBoardId(idValue);
    setCreateBoardOpen(false);
    resetBoardForm();
  }, [
    newBoardCategory,
    newBoardFilterKind,
    newBoardName,
    newBoardTag,
    resetBoardForm,
  ]);

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

  return (
    <div className="flex w-full flex-col gap-4">
      {toolbarLeft ? <div>{toolbarLeft}</div> : null}
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          type="search"
          placeholder={t('searchSignals')}
          aria-label={t('searchSignals')}
          onChange={(event) => onUpdateSearch(event.target.value)}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="w-full"
        />
        <div className="flex w-full items-center justify-end lg:w-auto">
          <div className="flex items-center gap-3">
            <div className="flex flex-row gap-2 h-full">
              <Checkbox
                id="hideArchivedSignalsCheckbox"
                className="self-center"
                checked={hideArchived}
                onCheckedChange={(value) => {
                  setHideArchived(value === true);
                }}
                disabled={isLoading}
              />
              <label
                className="text-[14px] self-center"
                htmlFor="hideArchivedSignalsCheckbox"
              >
                {t('hideArchived')}
              </label>
            </div>
            <Button
              variant="outline"
              colorVariant="neutral"
              className="w-auto"
              onClick={() => setCreateBoardOpen(true)}
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
            <DialogTitle>{t('createBoard')}</DialogTitle>
            <DialogDescription>{t('createBoardDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <label className="text-2 text-muted-foreground" htmlFor="boardNameInput">
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
              <label className="text-2 text-muted-foreground">{t('boardFilterBy')}</label>
              <Select
                value={newBoardFilterKind}
                onValueChange={(value) =>
                  setNewBoardFilterKind(value as BoardFilterKind)
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">{t('boardFilterCategory')}</SelectItem>
                  <SelectItem value="tag">{t('boardFilterTag')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newBoardFilterKind === 'category' ? (
              <div className="grid gap-1.5">
                <label className="text-2 text-muted-foreground">
                  {t('boardSelectCategory')}
                </label>
                <Select value={newBoardCategory} onValueChange={setNewBoardCategory}>
                  <SelectTrigger className="h-9">
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
                <label className="text-2 text-muted-foreground">{t('boardSelectTag')}</label>
                <Select value={newBoardTag} onValueChange={setNewBoardTag}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COHERENCE_TAGS.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tagLabelFor(tag)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              onClick={handleCreateBoard}
              disabled={!newBoardName.trim()}
            >
              {t('boardCreateAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {boards.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={activeBoardId === 'all' ? 'default' : 'outline'}
            colorVariant={activeBoardId === 'all' ? 'accent' : 'neutral'}
            size="sm"
            className="h-8 px-3"
            onClick={() => setActiveBoardId('all')}
          >
            {t('boardAll')}
          </Button>
          {boards.map((board) => (
            <div
              key={board.id}
              className="inline-flex items-center overflow-hidden rounded-md border border-border/70 bg-muted/30"
            >
              <button
                type="button"
                className={`h-8 px-3 text-2 transition-colors ${
                  activeBoardId === board.id
                    ? 'bg-accent-3 text-accent-11'
                    : 'text-foreground hover:bg-muted'
                }`}
                onClick={() => setActiveBoardId(board.id)}
              >
                {board.name}
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center border-l border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('boardDelete', { boardName: board.name })}
                title={t('boardDelete', { boardName: board.name })}
                onClick={() =>
                  setBoards((prev) => prev.filter((entry) => entry.id !== board.id))
                }
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {provisioningNoticeLines.length > 0 ? (
        <ErrorAlert lines={provisioningNoticeLines} bgColor="bg-yellow-600" />
      ) : null}

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>{t('listIsEmpty')}</p>
        </Empty>
      ) : (
        <div className="w-full space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <SignalGridContainer
              key={`signal-container-${index}`}
              basePath={basePath}
              leadImage={leadImage}
              pagination={{
                page: index + 1,
                firstPageSize,
                pageSize,
                searchTerm,
                order: [
                  {
                    dir: DirectionType.DESC,
                    name: 'id',
                  },
                ],
              }}
              signals={filteredSignals}
              refresh={refresh}
              onSignalClick={onSignalClick}
            />
          ))}
        </div>
      )}
      {pagination?.totalPages === 0 ? null : (
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
