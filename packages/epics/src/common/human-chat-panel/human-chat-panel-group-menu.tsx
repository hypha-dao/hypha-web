'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
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
  isArchivedGroupRoom,
  isRoomInDirectAccountData,
  normalizeGroupRoomName,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import { EventType } from 'matrix-js-sdk';
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
  const { jwt } = useJwt();
  const { client, ensureRoomMembers } = useMatrix();
  const selfId = client?.getUserId() ?? null;
  const room = client?.getRoom(roomId) ?? null;
  const inDirect = isRoomInDirectAccountData(
    client?.getAccountData(EventType.Direct)?.getContent() as
      | Record<string, unknown>
      | undefined,
    roomId,
  );
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

  const { data: home } = useSWR<MemberIntelligence | null>(
    addOpen && jwt
      ? ['/api/v1/people/me/intelligence', jwt, 'add-people']
      : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
  );
  const connections = home?.connections ?? [];
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({
    personIds: connections.map((person) => person.id),
  });
  const roomMemberIds = useMemo(() => {
    const current = client?.getRoom(roomId);
    const ids = new Set<string>();
    for (const member of current?.getMembers() ?? []) {
      if (member.membership !== 'join' && member.membership !== 'invite') {
        continue;
      }
      const id = member.userId?.trim().toLowerCase();
      if (id) ids.add(id);
    }
    return ids;
  }, [addOpen, archiveCheck, client, roomId]);
  const addablePeople = useMemo(() => {
    const needle = addQuery.trim().toLowerCase();
    return connections.filter((person) => {
      const mxid = personIdToMatrixUserId[person.id]?.trim().toLowerCase();
      if (!mxid || roomMemberIds.has(mxid)) return false;
      if (!needle) return true;
      const haystack = [person.name, person.surname, person.nickname]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [addQuery, connections, personIdToMatrixUserId, roomMemberIds]);

  if (!room || !isPeopleGroupChatRoom(room, { inDirect })) return null;

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
    if (memberIds.length === 0) return;
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
            {addablePeople.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {t('addPeopleEmpty')}
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
              disabled={busy || selected.size === 0}
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
