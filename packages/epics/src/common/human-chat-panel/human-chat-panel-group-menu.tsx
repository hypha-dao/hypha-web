'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, MoreHorizontal, Pencil } from 'lucide-react';
import {
  archiveGroupRoomAction,
  renameGroupRoomAction,
} from '@hypha-platform/core/matrix/server/actions';
import {
  GROUP_ROOM_NAME_MAX,
  normalizeGroupRoomName,
  useJwt,
  useMatrix,
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

import { isRememberedGroupChatRoom as isLocalGroupCreator } from '../../people/components/member-connections';
import {
  canArchivePeopleGroupRoom,
  isPeopleGroupChatRoom,
} from './people-group-room';

export { canArchivePeopleGroupRoom, isPeopleGroupChatRoom };

export function HumanChatPanelGroupMenu({
  roomId,
  title,
  onRenamed,
  onArchived,
}: {
  roomId: string;
  title: string;
  onRenamed: (name: string) => void;
  onArchived: () => void;
}) {
  const t = useTranslations('HumanChatPanel');
  const { jwt } = useJwt();
  const { client } = useMatrix();
  const selfId = client?.getUserId() ?? null;
  const room = client?.getRoom(roomId) ?? null;
  const canArchive = useMemo(
    () =>
      room
        ? canArchivePeopleGroupRoom(room, selfId, isLocalGroupCreator)
        : false,
    [room, selfId],
  );

  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!room || !isPeopleGroupChatRoom(room)) return null;

  function openRename() {
    setName(title);
    setError(null);
    setRenameOpen(true);
  }

  async function saveRename() {
    const next = normalizeGroupRoomName(name);
    const authToken = jwt?.trim();
    if (!next || !authToken) return;
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
    if (!authToken) return;
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
      onArchived();
    } catch {
      setError(t('archiveGroupFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
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
          {canArchive ? (
            <DropdownMenuItem
              onSelect={() => {
                setError(null);
                setArchiveOpen(true);
              }}
            >
              <Archive aria-hidden />
              {t('archiveGroup')}
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
    </>
  );
}
