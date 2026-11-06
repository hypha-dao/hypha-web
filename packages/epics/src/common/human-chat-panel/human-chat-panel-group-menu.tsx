'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { useDebounce } from 'use-debounce';
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  UserPlus,
} from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
} from '@hypha-platform/ui';

import {
  addPeopleCandidateStatus,
  addablePeopleForGroup,
  fetchMessageDirectorySearch,
  isRememberedGroupChatRoom as isLocalGroupCreator,
  rememberGroupChatMembers,
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

export function HumanChatPanelGroupMenu({
  roomId,
  title,
  onRenamed,
  onArchived,
  onUnarchived,
}: {
  roomId: string;
  title: string;
  onRenamed: (name: string) => void;
  onArchived?: () => void;
  onUnarchived?: () => void;
}) {
  const t = useTranslations('HumanChatPanel');
  const tConnections = useTranslations('Connections');
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
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [debouncedAddQuery] = useDebounce(addQuery.trim(), 200);

  // Shared-space page stays up while a search is in flight. Typing used to
  // replace this request, so a search ran against an empty directory.
  const {
    data: directoryHome,
    error: directoryError,
    isLoading: directoryLoading,
    isValidating: directoryValidating,
  } = useSWR<MemberIntelligence>(
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
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const term = debouncedAddQuery.trim();
    if (!addOpen || !jwt || !term) {
      setSearchHits(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    void (async () => {
      try {
        const people = await fetchMessageDirectorySearch(term, {
          headers: { Authorization: `Bearer ${jwt}` },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setSearchHits(people);
      } catch (searchError) {
        if (
          searchError instanceof DOMException &&
          searchError.name === 'AbortError'
        ) {
          return;
        }
        if (!controller.signal.aborted) setSearchHits([]);
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
      personIds: [
        ...directory.map((person) => person.id),
        ...(searchHits ?? []).map((person) => person.id),
        ...(directoryHome?.person.id != null ? [directoryHome.person.id] : []),
      ],
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

  function openRename() {
    setName(title);
    setError(null);
    openDialogAfterMenu(() => setRenameOpen(true));
  }

  function openAddPeople() {
    setSelected(new Set());
    setAddQuery('');
    setError(null);
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
    if (memberIds.length === 0 || memberIds.length !== selected.size) {
      setError(t('addPeopleFailed'));
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

  return (
    <>
      <DropdownMenu
        modal={false}
        onOpenChange={(open) => {
          if (open) setArchiveCheck((value) => value + 1);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-[36px] w-[36px] items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label={t('groupChatMenu')}
            title={t('groupChatMenu')}
          >
            <MoreHorizontal className="craft-icon" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={openRename}>
            <Pencil aria-hidden />
            {t('renameGroup')}
          </DropdownMenuItem>
          {archived ? null : (
            <DropdownMenuItem onSelect={openAddPeople}>
              <UserPlus aria-hidden />
              {t('addPeople')}
            </DropdownMenuItem>
          )}
          {canArchive && !archived ? (
            <DropdownMenuItem
              onSelect={() => {
                setError(null);
                openDialogAfterMenu(() => setArchiveOpen(true));
              }}
            >
              <Archive aria-hidden />
              {t('archiveGroup')}
            </DropdownMenuItem>
          ) : null}
          {canArchive && archived ? (
            <DropdownMenuItem
              onSelect={() => {
                setError(null);
                openDialogAfterMenu(() => setUnarchiveOpen(true));
              }}
            >
              <ArchiveRestore aria-hidden />
              {t('unarchiveGroup')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
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
                        if (next.has(person.id)) next.delete(person.id);
                        else next.add(person.id);
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
