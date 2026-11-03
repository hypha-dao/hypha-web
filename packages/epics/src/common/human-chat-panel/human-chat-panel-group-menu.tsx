'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { useDebounce } from 'use-debounce';
import { Archive, ArchiveRestore, Pencil, UserPlus } from 'lucide-react';
import {
  archiveGroupRoomAction,
  renameGroupRoomAction,
  unarchiveGroupRoomAction,
} from '@hypha-platform/core/matrix/server/actions';
import {
  GROUP_ROOM_NAME_MAX,
  MEMBER_CONNECTION_MAX,
  isArchivedGroupRoom,
  isHyphaBotMatrixIdentity,
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabel,
  normalizeGroupRoomName,
  uniqueCanonicalPrivySubsFromMxids,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  usePeopleBySubs,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  useIsMobile,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  addPeopleCandidateStatus,
  addablePeopleForGroup,
  fetchMessageDirectorySearch,
  isRememberedGroupChatRoom as isLocalGroupCreator,
  personIdsForMatrixLookup,
  rememberGroupChatMembers,
  selectedPeopleMissingMatrixId,
} from '../../people/components/member-connections';
import { PersonAvatar } from '../../people/components/person-avatar';
import { openDialogAfterMenu } from './open-dialog-after-menu';
import {
  canArchivePeopleGroupRoom,
  isPeopleGroupChatRoom,
} from './people-group-room';

export {
  canArchivePeopleGroupRoom,
  isPeopleGroupChatRoom,
  openDialogAfterMenu,
};

type ConnectionPerson = MemberIntelligence['connections'][number];

/**
 * Group management without a left-chrome `⋯` trigger.
 * Open details from the header title; open Add people from Members (or details).
 */
export function HumanChatPanelGroupMenu({
  roomId,
  title,
  onRenamed,
  onArchived,
  onUnarchived,
  detailsOpen = false,
  onDetailsOpenChange,
  addPeopleOpen,
  onAddPeopleOpenChange,
}: {
  roomId: string;
  title: string;
  onRenamed: (name: string) => void;
  onArchived?: () => void;
  onUnarchived?: () => void;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  addPeopleOpen?: boolean;
  onAddPeopleOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('HumanChatPanel');
  const tConnections = useTranslations('Connections');
  const isMobile = useIsMobile();
  const { jwt } = useJwt();
  const { client, ensureRoomMembers } = useMatrix();
  const selfId = client?.getUserId() ?? null;
  const room = client?.getRoom(roomId) ?? null;
  const [archiveCheck, setArchiveCheck] = useState(0);
  const archived = isArchivedGroupRoom(room);
  const canArchive = useMemo(() => {
    const current = client?.getRoom(roomId) ?? null;
    return current
      ? canArchivePeopleGroupRoom(current, selfId, isLocalGroupCreator)
      : false;
  }, [archiveCheck, client, roomId, selfId]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);
  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const addOpen = addPeopleOpen ?? internalAddOpen;
  const setAddOpen = onAddPeopleOpenChange ?? setInternalAddOpen;

  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [debouncedAddQuery] = useDebounce(addQuery.trim(), 200);

<<<<<<< HEAD
  // Shared-space page stays up while a search is in flight. Typing used to
  // replace this request, so a search ran against an empty directory.
  const {
    data: directoryHome,
    error: directoryError,
    isLoading: directoryLoading,
    isValidating: directoryValidating,
  } = useSWR<MemberIntelligence>(
=======
  useEffect(() => {
    if (detailsOpen) setArchiveCheck((value) => value + 1);
  }, [detailsOpen]);

  const { data: home } = useSWR<MemberIntelligence | null>(
>>>>>>> 777f8986a (fix(chat): sticky mobile chrome, presence strip, and group details UX)
    addOpen && jwt
      ? ['/api/v1/people/me/intelligence', jwt, 'add-people-directory']
      : null,
    async ([url, token]: [string, string]) => {
      const response = await fetch(
        `${url}?connections=${MEMBER_CONNECTION_MAX}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error('directory');
      return (await response.json()) as MemberIntelligence;
    },
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
  const [searchHits, setSearchHits] = useState<ConnectionPerson[] | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searching, setSearching] = useState(false);
  const selectedLabels = useRef(new Map<number, string>());
  useEffect(() => {
    const term = debouncedAddQuery.trim();
    if (!addOpen || !jwt || !term) {
      setSearchHits(null);
      setSearchFailed(false);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    void (async () => {
      try {
        const result = await fetchMessageDirectorySearch(term, {
          headers: { Authorization: `Bearer ${jwt}` },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSearchHits(result.people);
          setSearchFailed(result.failed);
        }
      } catch (searchError) {
        if (
          searchError instanceof DOMException &&
          searchError.name === 'AbortError'
        ) {
          return;
        }
        if (!controller.signal.aborted) {
          setSearchHits([]);
          setSearchFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    })();
    return () => controller.abort();
  }, [addOpen, debouncedAddQuery, jwt]);
  const directory = directoryHome?.connections ?? [];
  const directoryPending =
    directoryLoading || (directoryValidating && directoryHome == null);
  const directoryFailed =
    Boolean(addOpen && jwt) &&
    !directoryPending &&
    (directoryError != null || directoryHome == null);
  const { personIdToMatrixUserId, isLoading: matrixIdsLoading } =
    useMatrixUserIdsByPersonIds({
      personIds: personIdsForMatrixLookup([
        directory.map((person) => person.id),
        (searchHits ?? []).map((person) => person.id),
        [...selected],
        directoryHome?.person.id != null ? [directoryHome.person.id] : [],
      ]),
    });
  const roomMembers = useMemo(() => {
    const current = client?.getRoom(roomId);
    const ids = new Set<string>();
    const joined: { userId: string; label: string | null }[] = [];
    for (const member of current?.getMembers() ?? []) {
      if (member.membership !== 'join' && member.membership !== 'invite') {
        continue;
      }
      const userId = member.userId?.trim();
      if (!userId) continue;
      ids.add(userId.toLowerCase());
      if (isHyphaBotMatrixIdentity(userId)) continue;
      const raw = matrixMemberDisplayLabel(member, userId);
      joined.push({
        userId,
        label: looksLikeTechnicalMatrixDisplayName(raw, userId) ? null : raw,
      });
    }
    const self = selfId?.trim();
    if (self) ids.add(self.toLowerCase());
    return { ids, joined };
  }, [addOpen, archiveCheck, client, roomId, selfId]);
  const roomMemberIds = roomMembers.ids;
  const memberSubs = useMemo(
    () => uniqueCanonicalPrivySubsFromMxids([...roomMemberIds]),
    [roomMemberIds],
  );
  const { peopleBySub, isLoading: memberProfilesLoading } = usePeopleBySubs({
    subs: addOpen ? memberSubs : [],
  });
  const memberProfilesPending = addOpen && memberProfilesLoading;
  const addablePeople = useMemo(() => {
    const caller = directoryHome?.person;
    const occupants = [
      ...roomMembers.joined.map((member) => ({
        matrixUserId: member.userId,
        label: member.label,
      })),
      ...[...peopleBySub.values()].map((person) => ({
        personId: person.id,
        slug: person.slug,
        label:
          [person.name, person.surname].filter(Boolean).join(' ').trim() ||
          person.nickname,
      })),
      ...(caller
        ? [
            {
              personId: caller.id,
              slug: caller.slug,
              address: caller.address,
              label:
                [caller.name, caller.surname]
                  .filter(Boolean)
                  .join(' ')
                  .trim() || caller.nickname,
            },
          ]
        : []),
    ];
    return addablePeopleForGroup(
      directory,
      debouncedAddQuery ? searchHits : null,
      personIdToMatrixUserId,
      roomMemberIds,
      addQuery,
      occupants,
    );
  }, [
    addQuery,
    debouncedAddQuery,
    directory,
    directoryHome?.person,
    peopleBySub,
    personIdToMatrixUserId,
    roomMemberIds,
    roomMembers.joined,
    searchHits,
  ]);
  const listStatus = addPeopleCandidateStatus({
    query: addQuery,
    debouncedQuery: debouncedAddQuery,
    // Member profiles supply the person id and name used to hide people who
    // are already in the room. Showing the list before that arrives flashes
    // those members as add candidates.
    directoryLoaded: directoryHome != null && !memberProfilesPending,
    directoryFailed: directoryFailed && !memberProfilesPending,
    searching: searching || memberProfilesPending,
    searchFailed,
    matchCount: memberProfilesPending ? 0 : addablePeople.length,
  });
  const selectedMissingMatrixId = [...selected].some(
    (id) => !personIdToMatrixUserId[id]?.trim(),
  );

  if (!room || !isPeopleGroupChatRoom(room)) return null;

  function personLabel(person: ConnectionPerson) {
    return (
      [person.name, person.surname].filter(Boolean).join(' ').trim() ||
      person.nickname ||
      person.slug ||
      ''
    );
  }

  function closeDetails() {
    onDetailsOpenChange?.(false);
  }

  function openRename() {
    setName(title);
    setError(null);
    closeDetails();
    openDialogAfterMenu(() => setRenameOpen(true));
  }

  function openAddPeople() {
    setSelected(new Set());
    selectedLabels.current.clear();
    setAddQuery('');
    setError(null);
    closeDetails();
    openDialogAfterMenu(() => setAddOpen(true));
  }

  async function saveRename() {
    const next = normalizeGroupRoomName(name);
    if (!next) return;
    const authToken = jwt?.trim();
    if (!authToken) {
      setError(t('renameGroupFailed'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await renameGroupRoomAction({
        roomId,
        name: next,
        authToken,
      });
      if (!result) {
        setError(t('renameGroupFailed'));
        return;
      }
      onRenamed(result.name);
      setRenameOpen(false);
    } catch {
      setError(t('renameGroupFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchive() {
    const authToken = jwt?.trim();
    if (!authToken) {
      setError(t('archiveGroupFailed'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await archiveGroupRoomAction({
        roomId,
        authToken,
      });
      if (!result) {
        setError(t('archiveGroupFailed'));
        return;
      }
      setArchiveOpen(false);
      onArchived?.();
    } catch {
      setError(t('archiveGroupFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmUnarchive() {
    const authToken = jwt?.trim();
    if (!authToken) {
      setError(t('unarchiveGroupFailed'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await unarchiveGroupRoomAction({
        roomId,
        authToken,
      });
      if (!result) {
        setError(t('unarchiveGroupFailed'));
        return;
      }
      setUnarchiveOpen(false);
      onUnarchived?.();
    } catch {
      setError(t('unarchiveGroupFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAddPeople() {
    const memberIds = [...selected].flatMap((id) => {
      const mxid = personIdToMatrixUserId[id]?.trim();
      return mxid ? [mxid] : [];
    });
    if (memberIds.length !== selected.size) {
      const labels: Record<number, string> = {};
      for (const [id, label] of selectedLabels.current) labels[id] = label;
      const names = selectedPeopleMissingMatrixId(
        [...selected],
        personIdToMatrixUserId,
        labels,
      );
      setError(
        names.length > 0
          ? t('addPeopleMissingMatrix', { names: names.join(', ') })
          : t('addPeopleFailed'),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      rememberGroupChatMembers(roomId, memberIds);
      await ensureRoomMembers(roomId, memberIds);
      setAddOpen(false);
      setSelected(new Set());
    } catch {
      setError(t('addPeopleFailed'));
    } finally {
      setBusy(false);
    }
  }

  const detailsActions = (
    <div className="flex flex-col gap-0.5 p-2">
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-left text-sm text-foreground',
          'hover:bg-foreground/[0.04]',
        )}
        onClick={openRename}
      >
        <Pencil
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        {t('renameGroup')}
      </button>
      {archived ? null : (
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-left text-sm text-foreground',
            'hover:bg-foreground/[0.04]',
          )}
          onClick={openAddPeople}
        >
          <UserPlus
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          {t('addPeople')}
        </button>
      )}
      {canArchive && !archived ? (
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-left text-sm text-foreground',
            'hover:bg-foreground/[0.04]',
          )}
          onClick={() => {
            setError(null);
            closeDetails();
            openDialogAfterMenu(() => setArchiveOpen(true));
          }}
        >
          <Archive
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          {t('archiveGroup')}
        </button>
      ) : null}
      {canArchive && archived ? (
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-left text-sm text-foreground',
            'hover:bg-foreground/[0.04]',
          )}
          onClick={() => {
            setError(null);
            closeDetails();
            openDialogAfterMenu(() => setUnarchiveOpen(true));
          }}
        >
          <ArchiveRestore
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          {t('unarchiveGroup')}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet
          open={detailsOpen}
          onOpenChange={(open) => onDetailsOpenChange?.(open)}
        >
          <SheetContent
            side="bottom"
            showClose={false}
            className={cn(
              'max-h-[min(85vh,480px)] gap-0 rounded-t-2xl border-border p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
              'bg-background font-sans text-foreground shadow-lg',
            )}
          >
            <SheetHeader className="border-b border-border/70 px-4 py-3 text-left">
              <SheetTitle className="truncate text-base">{title}</SheetTitle>
              <SheetDescription className="sr-only">
                {t('groupDetailsDescription')}
              </SheetDescription>
            </SheetHeader>
            <div
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
              aria-hidden
            />
            {detailsActions}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={detailsOpen}
          onOpenChange={(open) => onDetailsOpenChange?.(open)}
        >
          <DialogContent className="max-w-sm gap-0 p-0">
            <DialogHeader className="border-b border-border/70 px-4 py-3 text-left">
              <DialogTitle className="truncate text-base">{title}</DialogTitle>
              <DialogDescription className="sr-only">
                {t('groupDetailsDescription')}
              </DialogDescription>
            </DialogHeader>
            {detailsActions}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('renameGroupTitle')}</DialogTitle>
            <DialogDescription>{t('renameGroupDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="hypha-group-room-name">
              {t('renameGroupName')}
            </Label>
            <Input
              id="hypha-group-room-name"
              value={name}
              maxLength={GROUP_ROOM_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                if ((event.nativeEvent as KeyboardEvent).isComposing) return;
                event.preventDefault();
                void saveRename();
              }}
            />
          </div>
          {error && renameOpen ? (
            <p className="text-sm text-error-11" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              disabled={busy}
              onClick={() => setRenameOpen(false)}
            >
              {t('renameGroupCancel')}
            </Button>
            <Button
              type="button"
              disabled={busy || !normalizeGroupRoomName(name)}
              onClick={() => void saveRename()}
            >
              {t('renameGroupSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setSelected(new Set());
            setAddQuery('');
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addPeopleTitle')}</DialogTitle>
            <DialogDescription>{t('addPeopleDescription')}</DialogDescription>
          </DialogHeader>
          <Input
            value={addQuery}
            onChange={(event) => setAddQuery(event.target.value)}
            placeholder={t('addPeopleSearch')}
          />
          <div className="max-h-72 overflow-y-auto border border-border">
            {listStatus !== 'results' ? (
              <p className="p-3 text-sm text-muted-foreground">
                {listStatus === 'loading'
                  ? tConnections('loading')
                  : listStatus === 'no-matches'
                  ? t('addPeopleNoMatches')
                  : listStatus === 'load-failed'
                  ? t('addPeopleLoadFailed')
                  : t('addPeopleEmpty')}
              </p>
            ) : (
              addablePeople.map((person) => {
                const checked = selected.has(person.id);
                const label = personLabel(person);
                return (
                  <button
                    key={person.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent-2"
                    aria-pressed={checked}
                    onClick={() => {
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(person.id)) {
                          next.delete(person.id);
                          selectedLabels.current.delete(person.id);
                        } else {
                          next.add(person.id);
                          if (label)
                            selectedLabels.current.set(person.id, label);
                        }
                        return next;
                      });
                    }}
                  >
                    <PersonAvatar
                      size="chat"
                      shape="circle"
                      avatarSrc={person.avatarUrl ?? undefined}
                      userName={label}
                      personId={person.id}
                    />
                    <span className="min-w-0 flex-1 truncate text-2">
                      {label}
                    </span>
                    <span className="text-1 text-muted-foreground">
                      {checked ? '✓' : ''}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {error && addOpen ? (
            <p className="text-sm text-error-11" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              disabled={busy}
              onClick={() => setAddOpen(false)}
            >
              {t('addPeopleCancel')}
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                selected.size === 0 ||
                (matrixIdsLoading && selectedMissingMatrixId)
              }
              onClick={() => void confirmAddPeople()}
            >
              {t('addPeopleConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archiveGroupTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('archiveGroupDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && archiveOpen ? (
            <p className="text-sm text-error-11" role="alert">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t('archiveGroupCancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              colorVariant="error"
              disabled={busy}
              onClick={() => void confirmArchive()}
            >
              {t('archiveGroupConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unarchiveOpen} onOpenChange={setUnarchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unarchiveGroupTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unarchiveGroupDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && unarchiveOpen ? (
            <p className="text-sm text-error-11" role="alert">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t('unarchiveGroupCancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void confirmUnarchive()}
            >
              {t('unarchiveGroupConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
