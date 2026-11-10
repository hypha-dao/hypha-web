'use client';

import {
  QUEST_DEFAULT_REWARD_TOKENS,
  bulletsToMarkdownList,
  splitMarkdownLinesToBullets,
  stripViewerYouMarker,
  type Person,
  milestoneEditorChrome,
  type QuestDeliverableRecord,
  type QuestMilestoneStatus,
  type QuestReward,
} from '@hypha-platform/core/client';
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogTitle,
  Image,
  Input,
  RichTextEditor,
} from '@hypha-platform/ui';
import {
  storedQuestPlainField,
  storedQuestRichText,
} from '../utils/quest-rich-text';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import { QuestMilestoneStatusSelect } from './quest-milestone-status-select';
import { shouldResetQuestModalDraft } from '../utils/modal-draft-reset';
import { PersonAvatar } from '../../people/components/person-avatar';
import { QuestRewardRowsEditor } from './quest-reward-tokens';

const UNASSIGNED_MEMBER = '__unassigned__';

function keepMemberSelectPopoverOpen(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}) {
  const target = event.target as HTMLElement | null;
  if (
    target?.closest('[data-pipeline-select-content="true"]') ||
    target?.closest('[data-hypha-combobox-content]')
  ) {
    event.preventDefault();
  }
}

function MemberOptionFace({
  label,
  avatarUrl,
}: {
  label: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={24}
        height={24}
        className="size-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-4 text-[11px] font-semibold text-neutral-11">
      {label.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function QuestRosterCombobox({
  members,
  value,
  onChange,
  placeholder,
  allowUnassigned = false,
}: {
  members: readonly Person[];
  value: string | null;
  onChange: (person: Person | null) => void;
  placeholder: string;
  allowUnassigned?: boolean;
}) {
  const roster = members.filter((person) => person.id > 0);
  const options = [
    ...(allowUnassigned
      ? [
          {
            value: UNASSIGNED_MEMBER,
            label: 'Unassigned',
            searchText: 'unassigned',
            avatarUrl: null as string | null,
          },
        ]
      : []),
    ...roster.map((person) => {
      const label = personRosterDisplayLabel(person, 'Participant');
      return {
        value: String(person.id),
        label,
        searchText: [label, person.nickname, person.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        avatarUrl: person.avatarUrl ?? null,
      };
    }),
  ];

  return (
    <Combobox
      options={options}
      initialValue={value ?? (allowUnassigned ? UNASSIGNED_MEMBER : '')}
      placeholder={placeholder}
      searchPlaceholder="Search participants…"
      emptyListMessage="No participants found."
      allowEmptyChoice={false}
      popoverModal={false}
      className="h-10 w-full justify-between rounded-none px-3 text-left font-normal normal-case tracking-normal md:w-full"
      onChange={(next) => {
        if (!next || next === UNASSIGNED_MEMBER) {
          onChange(null);
          return;
        }
        onChange(roster.find((person) => String(person.id) === next) ?? null);
      }}
      renderOption={(option) => (
        <>
          {option.value === UNASSIGNED_MEMBER ? (
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-4 text-[11px] text-neutral-11">
              —
            </span>
          ) : (
            <MemberOptionFace
              label={option.label}
              avatarUrl={option.avatarUrl}
            />
          )}
          <span className="truncate">{option.label}</span>
        </>
      )}
      renderValue={(option) =>
        option ? (
          <span className="flex min-w-0 flex-1 items-center justify-start gap-2 text-left">
            {option.value === UNASSIGNED_MEMBER ? null : (
              <MemberOptionFace
                label={option.label}
                avatarUrl={option.avatarUrl}
              />
            )}
            <span className="truncate text-left">{option.label}</span>
          </span>
        ) : (
          <span className="truncate text-left text-neutral-11">
            {placeholder}
          </span>
        )
      }
    />
  );
}

function buildMemberPersonCatalog(
  spaceMembers: readonly Person[],
  extraNames: readonly (string | null | undefined)[],
): Person[] {
  const byId = new Map<number, Person>();
  const knownNames = new Set<string>();

  for (const person of spaceMembers) {
    if (!person || typeof person.id !== 'number') continue;
    const label = personRosterDisplayLabel(person, '').trim();
    if (!label) continue;
    if (
      byId.has(person.id) ||
      (person.id <= 0 && knownNames.has(label.toLowerCase()))
    )
      continue;
    byId.set(person.id, person);
    knownNames.add(label.toLowerCase());
  }

  let syntheticId = -1;
  for (const raw of extraNames) {
    const clean = raw ? stripViewerYouMarker(raw).trim() : '';
    if (!clean || knownNames.has(clean.toLowerCase())) continue;
    knownNames.add(clean.toLowerCase());
    byId.set(syntheticId, {
      id: syntheticId,
      name: clean,
      surname: '',
    } as Person);
    syntheticId -= 1;
  }

  return [...byId.values()];
}

function findPersonInCatalog(
  catalog: readonly Person[],
  query: { id?: string | number | null; name?: string | null },
): Person | null {
  if (query.id != null && query.id !== '') {
    const numeric = Number(query.id);
    if (Number.isFinite(numeric)) {
      const byId = catalog.find((p) => p.id === numeric);
      if (byId) return byId;
    }
  }
  const clean = query.name
    ? stripViewerYouMarker(query.name).trim().toLowerCase()
    : '';
  if (!clean) return null;
  return (
    catalog.find(
      (p) =>
        personRosterDisplayLabel(p, '').trim().toLowerCase() === clean ||
        (p.nickname && p.nickname.trim().toLowerCase() === clean),
    ) ?? null
  );
}

export type EditableQuestMilestone = {
  id?: number;
  name: string;
  description: string;
  dueDate: string | null;
  ownerPersonId?: number | null;
  ownerName: string | null;
  status: QuestMilestoneStatus;
  insertedNew?: boolean;
  wasOrder?: number;
};

export type EditableQuestMember = {
  id?: number;
  personId?: number | null;
  memberName: string;
  memberAvatarUrl?: string | null;
  roleLabel?: string | null;
  responsibilities: string[];
};

export type EditableQuestDeliverable = {
  id?: number;
  name: string;
  url: string;
  note: string;
};

const LABEL_CLASS =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11';

/**
 * Same shell as the signal description dialog: pinned header and footer,
 * scrolling body, width capped to the viewport. `packages/ui` Button default
 * is the 40px labeled control.
 */
const QUEST_EDIT_DIALOG_CLASS =
  'flex min-h-0 flex-col gap-0 overflow-hidden p-0';

const EDITOR_FRAME =
  'min-w-0 max-w-full overflow-hidden border border-border bg-background [&_.ProseMirror]:max-w-full [&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:[overflow-wrap:anywhere] [&_.tiptap]:max-w-full [&_.tiptap]:whitespace-pre-wrap [&_.tiptap]:[overflow-wrap:anywhere]';

function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <DialogTitle className="font-display text-[18px] font-semibold text-foreground">
          {title}
        </DialogTitle>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-11 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      {subtitle ? <p className="text-xs text-neutral-11">{subtitle}</p> : null}
    </div>
  );
}

function ModalFooter({
  onCancel,
  onSave,
  disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        colorVariant="neutral"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        type="button"
        colorVariant="neutral"
        disabled={disabled}
        className="bg-foreground text-background hover:bg-foreground/90"
        onClick={onSave}
      >
        Save
      </Button>
    </div>
  );
}

function QuestEditDialogFrame({
  title,
  subtitle,
  onClose,
  onCancel,
  onSave,
  saveDisabled,
  children,
  className,
  ...contentProps
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<
  ComponentProps<typeof DialogContent>,
  'children' | 'className' | 'title'
>) {
  return (
    <DialogContent
      hideCloseButton
      data-quest-edit-dialog=""
      className={cn(QUEST_EDIT_DIALOG_CLASS, className)}
      {...contentProps}
    >
      <style>{`
        [data-quest-edit-dialog] .ProseMirror,
        [data-quest-edit-dialog] .tiptap {
          max-width: 100%;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      `}</style>
      <div className="shrink-0 px-5 pb-3 pt-5">
        <ModalHeader title={title} subtitle={subtitle} onClose={onClose} />
      </div>
      <div
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-3 [overflow-wrap:anywhere]"
        data-testid="quest-edit-dialog-body"
        style={{ overflowWrap: 'anywhere' }}
      >
        {children}
      </div>
      <div className="shrink-0 border-t border-border bg-background px-5 py-3">
        <ModalFooter
          onCancel={onCancel}
          onSave={onSave}
          disabled={saveDisabled}
        />
      </div>
    </DialogContent>
  );
}

export function EditQuestNameModal({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit name"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        saveDisabled={!draft.trim()}
        onSave={() => {
          if (!draft.trim()) return;
          onSave(draft.trim());
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>NAME</label>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Onboarding matcher"
            className="h-10 rounded-none bg-background-2"
          />
        </div>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

export function EditQuestGoalModal({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit goal"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onSave={() => {
          onSave(storedQuestRichText(draft));
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>GOAL</label>
          <div className={EDITOR_FRAME}>
            <RichTextEditor
              compactToolbar
              markdown={draft}
              onChange={setDraft}
              placeholder="Describe the quest goal…"
              bordered={false}
            />
          </div>
        </div>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

export function EditQuestScopeModal({
  open,
  onOpenChange,
  scopeIn,
  scopeOut,
  scopeInMarkdown,
  scopeOutMarkdown,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeIn: string[];
  scopeOut: string[];
  scopeInMarkdown?: string;
  scopeOutMarkdown?: string;
  onSave: (next: {
    scopeIn: string[];
    scopeOut: string[];
    scopeInMarkdown: string;
    scopeOutMarkdown: string;
  }) => void;
}) {
  const [inMd, setInMd] = useState(
    scopeInMarkdown?.trim() || bulletsToMarkdownList(scopeIn),
  );
  const [outMd, setOutMd] = useState(
    scopeOutMarkdown?.trim() || bulletsToMarkdownList(scopeOut),
  );
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (shouldResetQuestModalDraft(open, wasOpen)) {
      setInMd(scopeInMarkdown?.trim() || bulletsToMarkdownList(scopeIn));
      setOutMd(scopeOutMarkdown?.trim() || bulletsToMarkdownList(scopeOut));
    }
  }, [open, scopeIn, scopeInMarkdown, scopeOut, scopeOutMarkdown]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit scope"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onSave={() => {
          const scopeInMarkdown = storedQuestRichText(inMd);
          const scopeOutMarkdown = storedQuestRichText(outMd);
          onSave({
            scopeIn: splitMarkdownLinesToBullets(scopeInMarkdown),
            scopeOut: splitMarkdownLinesToBullets(scopeOutMarkdown),
            scopeInMarkdown,
            scopeOutMarkdown,
          });
          onOpenChange(false);
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>IN SCOPE</label>
            <div className={EDITOR_FRAME}>
              <RichTextEditor
                compactToolbar
                markdown={inMd}
                onChange={setInMd}
                placeholder="• First item in scope…"
                bordered={false}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>OUT OF SCOPE</label>
            <div className={EDITOR_FRAME}>
              <RichTextEditor
                compactToolbar
                markdown={outMd}
                onChange={setOutMd}
                placeholder="• First item out of scope…"
                bordered={false}
              />
            </div>
          </div>
        </div>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

export function EditQuestSuccessModal({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit success criteria"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onSave={() => {
          onSave(storedQuestRichText(draft));
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>SUCCESS CRITERIA</label>
          <div className={EDITOR_FRAME}>
            <RichTextEditor
              compactToolbar
              markdown={draft}
              onChange={setDraft}
              placeholder="• Measurable outcome…"
              bordered={false}
            />
          </div>
        </div>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

export function EditQuestLeadModal({
  open,
  onOpenChange,
  leadName,
  leadPersonId,
  spaceMembers = [],
  spaceMemberNames = [],
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  leadPersonId?: number | null;
  spaceMembers?: Person[];
  spaceMemberNames?: string[];
  onSave: (nextLeadName: string, nextLeadPersonId?: number | null) => void;
}) {
  const catalog = useMemo(
    () =>
      buildMemberPersonCatalog(spaceMembers, [
        leadName,
        ...spaceMemberNames,
      ]).filter((p) => p.id > 0),
    [leadName, spaceMemberNames, spaceMembers],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open || wasOpen) return;
    const match = findPersonInCatalog(catalog, {
      id: leadPersonId,
      name: leadName,
    });
    setSelectedId(match ? String(match.id) : null);
  }, [catalog, leadName, leadPersonId, open]);

  const selectedPerson = useMemo(
    () => findPersonInCatalog(catalog, { id: selectedId, name: leadName }),
    [catalog, leadName, selectedId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit lead"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        saveDisabled={!selectedPerson}
        onPointerDownOutside={keepMemberSelectPopoverOpen}
        onInteractOutside={keepMemberSelectPopoverOpen}
        onFocusOutside={keepMemberSelectPopoverOpen}
        onSave={() => {
          if (!selectedPerson) return;
          const label = personRosterDisplayLabel(
            selectedPerson,
            'Participant',
          ).trim();
          if (!label) return;
          onSave(label, selectedPerson.id > 0 ? selectedPerson.id : null);
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>LEAD</label>
          <QuestRosterCombobox
            members={catalog}
            value={selectedId}
            placeholder="Select a participant…"
            onChange={(next) => setSelectedId(next ? String(next.id) : null)}
          />
        </div>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

export function EditQuestTargetDateModal({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | null;
  onSave: (next: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => {
    if (open) setDraft(value ?? '');
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit target date"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onSave={() => {
          onSave(draft.trim() || null);
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>TARGET DATE</label>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="20 November 2026"
            className="h-10 rounded-none bg-background-2"
          />
        </div>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

export function EditQuestRewardsModal({
  open,
  onOpenChange,
  rewards,
  spaceSlug,
  tokenSymbols = QUEST_DEFAULT_REWARD_TOKENS,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewards: QuestReward[];
  spaceSlug?: string;
  tokenSymbols?: readonly string[];
  onSave: (next: QuestReward[]) => void;
}) {
  const [rows, setRows] = useState<QuestReward[]>(rewards);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open && !wasOpen) {
      setRows(rewards.length > 0 ? rewards : [{ amount: '', token: 'USDC' }]);
    }
  }, [open, rewards]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit quest reward"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onSave={() => {
          onSave(
            rows.filter(
              (r) => r.amount.trim().length > 0 && r.token.trim().length > 0,
            ),
          );
          onOpenChange(false);
        }}
      >
        <div className="space-y-2.5">
          <label className={LABEL_CLASS}>QUEST REWARD</label>
          <QuestRewardRowsEditor
            rows={rows}
            onChange={setRows}
            spaceSlug={spaceSlug}
            tokenSymbols={tokenSymbols}
          />
        </div>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

/**
 * Edit Milestones modal (Figma node 47:2):
 * Each milestone has a name, target date, owner, and RichTextEditor description.
 * Supports "+ Add milestone here" between rows with automatic M1/M2/M3… renumbering,
 * plus "+ Add milestone at end".
 */
export function EditQuestMilestonesModal({
  open,
  onOpenChange,
  milestones,
  spaceMembers = [],
  spaceMemberNames = [],
  showStatusSelect = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestones: EditableQuestMilestone[];
  spaceMembers?: Person[];
  spaceMemberNames?: string[];
  showStatusSelect?: boolean;
  onSave: (next: EditableQuestMilestone[]) => void;
}) {
  const [rows, setRows] = useState<EditableQuestMilestone[]>(() =>
    milestones.map((milestone, index) => ({
      ...milestone,
      insertedNew: false,
      wasOrder: index + 1,
    })),
  );
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open && !wasOpen) {
      setRows(
        milestones.map((m, i) => ({
          ...m,
          insertedNew: false,
          wasOrder: i + 1,
        })),
      );
    }
  }, [milestones, open]);

  const ownerCatalog = useMemo(
    () =>
      buildMemberPersonCatalog(spaceMembers, [
        ...spaceMemberNames,
        ...rows.map((r) => r.ownerName),
      ]),
    [rows, spaceMemberNames, spaceMembers],
  );
  const defaultOwnerName: string | null = null;
  const defaultOwnerId: number | null = null;

  const insertAt = (index: number) => {
    setRows((current) => {
      const next = [...current];
      next.splice(index, 0, {
        name: '',
        description: '',
        dueDate: '',
        ownerPersonId: defaultOwnerId,
        ownerName: defaultOwnerName,
        status: 'not_started',
        insertedNew: true,
      });
      return next;
    });
  };

  const removeAt = (index: number) => {
    setRows((current) => current.filter((_, idx) => idx !== index));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(target, 0, item);
      return next;
    });
  };

  const chrome = milestoneEditorChrome(rows.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit milestones"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onPointerDownOutside={keepMemberSelectPopoverOpen}
        onInteractOutside={keepMemberSelectPopoverOpen}
        onFocusOutside={keepMemberSelectPopoverOpen}
        onSave={() => {
          const cleaned = rows
            .map((r) => ({
              ...r,
              name: r.name.trim(),
              description: storedQuestRichText(r.description),
              dueDate: r.dueDate?.trim() || null,
              ownerName: r.ownerName?.trim() || null,
            }))
            .filter((r) => r.name.length > 0);
          onSave(cleaned);
          onOpenChange(false);
        }}
      >
        <div className="space-y-3">
          {rows.map((item, idx) => {
            const order = idx + 1;
            const renumberedLabel = `M${order}`;

            return (
              <div key={idx} className="space-y-3">
                {idx > 0 ? (
                  <div className="flex items-center gap-2 py-1">
                    <div className="h-px flex-1 border-t border-dashed border-border" />
                    <button
                      type="button"
                      onClick={() => insertAt(idx)}
                      data-testid={`insert-milestone-before-${order}`}
                      className="border border-border bg-background px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-neutral-3"
                    >
                      Add milestone here
                    </button>
                    <div className="h-px flex-1 border-t border-dashed border-border" />
                  </div>
                ) : null}

                <div className="space-y-2.5 border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-neutral-11">
                      {renumberedLabel}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${renumberedLabel} up`}
                        disabled={idx === 0}
                        onClick={() => moveRow(idx, -1)}
                        data-testid={`move-milestone-up-${order}`}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${renumberedLabel} down`}
                        disabled={idx >= rows.length - 1}
                        onClick={() => moveRow(idx, 1)}
                        data-testid={`move-milestone-down-${order}`}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeAt(idx)}
                          className="text-xs text-neutral-11 hover:text-foreground"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <div className="flex-1 space-y-1">
                      <label className={LABEL_CLASS}>NAME</label>
                      <Input
                        value={item.name}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...item, name: e.target.value };
                          setRows(next);
                        }}
                        placeholder="e.g. Draft review with stewards"
                        className="h-10 rounded-none bg-background"
                      />
                    </div>
                    <div className="w-full space-y-1 sm:w-[140px]">
                      <label className={LABEL_CLASS}>TARGET DATE</label>
                      <Input
                        value={item.dueDate ?? ''}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...item, dueDate: e.target.value };
                          setRows(next);
                        }}
                        placeholder="Nov 13"
                        className="h-10 rounded-none bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <div
                      className="min-w-0 flex-1 space-y-1"
                      data-testid={`quest-milestone-owner-${order}`}
                    >
                      <label className={LABEL_CLASS}>OWNER</label>
                      <QuestRosterCombobox
                        members={ownerCatalog}
                        allowUnassigned
                        value={(() => {
                          const matched = findPersonInCatalog(ownerCatalog, {
                            id: item.ownerPersonId,
                            name: item.ownerName,
                          });
                          return matched && matched.id > 0
                            ? String(matched.id)
                            : UNASSIGNED_MEMBER;
                        })()}
                        placeholder="Unassigned"
                        onChange={(next) => {
                          const rowsNext = [...rows];
                          rowsNext[idx] = {
                            ...item,
                            ownerPersonId: next && next.id > 0 ? next.id : null,
                            ownerName: next
                              ? personRosterDisplayLabel(
                                  next,
                                  'Participant',
                                ).trim() || null
                              : null,
                          };
                          setRows(rowsNext);
                        }}
                      />
                    </div>
                    {showStatusSelect ? (
                      <div className="w-full space-y-1 sm:w-[150px]">
                        <label className={LABEL_CLASS}>STATUS</label>
                        <QuestMilestoneStatusSelect
                          value={item.status}
                          ariaLabel="Status"
                          className="w-full"
                          onChange={(status) => {
                            const next = [...rows];
                            next[idx] = { ...item, status };
                            setRows(next);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>DESCRIPTION</label>
                    <div className={EDITOR_FRAME}>
                      <RichTextEditor
                        compactToolbar
                        markdown={item.description}
                        onChange={(md) => {
                          const next = [...rows];
                          next[idx] = { ...item, description: md };
                          setRows(next);
                        }}
                        placeholder="• Milestone deliverables and criteria…"
                        bordered={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() =>
            setRows([
              ...rows,
              {
                name: '',
                description: '',
                dueDate: '',
                ownerPersonId: defaultOwnerId,
                ownerName: defaultOwnerName,
                status: 'not_started',
                insertedNew: true,
              },
            ])
          }
          data-testid="add-milestone-at-end"
          className="text-xs font-semibold text-foreground hover:underline"
        >
          {chrome.addLabel}
        </button>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

/**
 * Edit Members modal (Figma node 32:148 & 33:2):
 * Lists members with RESPONSIBILITY bullets (+ Add bullet) and an ADD MEMBER box
 * (PERSON picker + RESPONSIBILITY bullets + ADD TO QUEST).
 */
export function EditQuestMembersModal({
  open,
  onOpenChange,
  members,
  spaceMembers = [],
  spaceMemberNames = [],
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: EditableQuestMember[];
  spaceMembers?: Person[];
  spaceMemberNames?: string[];
  onSave: (next: EditableQuestMember[]) => void;
}) {
  const [rows, setRows] = useState<EditableQuestMember[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newBullets, setNewBullets] = useState<string[]>(['']);
  const wasOpenRef = useRef(false);

  const memberCatalog = useMemo(
    () =>
      buildMemberPersonCatalog(spaceMembers, [
        ...spaceMemberNames,
        ...members.map((m) => m.memberName),
      ]),
    [members, spaceMemberNames, spaceMembers],
  );

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open && !wasOpen) {
      setRows(
        members.map((m) => {
          const matched = findPersonInCatalog(memberCatalog, {
            id: m.personId,
            name: m.memberName,
          });
          return {
            ...m,
            personId:
              m.personId ?? (matched && matched.id > 0 ? matched.id : null),
            memberAvatarUrl: m.memberAvatarUrl ?? matched?.avatarUrl ?? null,
            responsibilities:
              m.responsibilities.length > 0 ? [...m.responsibilities] : [''],
          };
        }),
      );
      setSelectedPersonId(null);
      setNewRoleLabel('');
      setNewBullets(['']);
    }
  }, [memberCatalog, members, open]);

  const selectedPerson = useMemo(
    () => findPersonInCatalog(memberCatalog, { id: selectedPersonId }),
    [memberCatalog, selectedPersonId],
  );

  const handleAddMemberToQuest = () => {
    if (!selectedPerson) return;
    const cleanName = personRosterDisplayLabel(
      selectedPerson,
      'Participant',
    ).trim();
    if (!cleanName) return;
    const bullets = newBullets.map((b) => b.trim()).filter(Boolean);
    setRows([
      ...rows,
      {
        personId: selectedPerson.id > 0 ? selectedPerson.id : null,
        memberName: cleanName,
        memberAvatarUrl: selectedPerson.avatarUrl ?? null,
        roleLabel: newRoleLabel.trim().slice(0, 80) || null,
        responsibilities: bullets.length > 0 ? bullets : ['Core contributor'],
      },
    ]);
    setSelectedPersonId(null);
    setNewRoleLabel('');
    setNewBullets(['']);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit participants"
        subtitle="Who is on this quest, and what concrete outcomes each person owns (one bullet per outcome)."
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onPointerDownOutside={keepMemberSelectPopoverOpen}
        onInteractOutside={keepMemberSelectPopoverOpen}
        onFocusOutside={keepMemberSelectPopoverOpen}
        onSave={() => {
          const cleaned = rows
            .map((m) => ({
              ...m,
              memberName: m.memberName.trim(),
              roleLabel: m.roleLabel?.trim().slice(0, 80) || null,
              responsibilities: m.responsibilities
                .map((r) => r.trim())
                .filter(Boolean),
            }))
            .filter((m) => m.memberName.length > 0);
          onSave(cleaned);
          onOpenChange(false);
        }}
      >
        <div className="space-y-2.5">
          {rows.map((member, mIdx) => {
            return (
              <div
                key={mIdx}
                className="space-y-2 border border-border bg-background p-3"
              >
                <div className="flex items-center gap-2.5">
                  <PersonAvatar
                    size="sm"
                    shape="circle"
                    avatarSrc={member.memberAvatarUrl ?? undefined}
                    userName={member.memberName}
                    personId={
                      member.personId && member.personId > 0
                        ? member.personId
                        : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {member.memberName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRows(rows.filter((_, idx) => idx !== mIdx))
                    }
                    className="text-xs text-neutral-11 hover:text-foreground"
                    aria-label={`Remove ${member.memberName}`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1">
                  <label
                    className={LABEL_CLASS}
                    htmlFor={`quest-participant-role-${mIdx}`}
                  >
                    ROLE
                  </label>
                  <Input
                    id={`quest-participant-role-${mIdx}`}
                    value={member.roleLabel ?? ''}
                    maxLength={80}
                    onChange={(e) => {
                      const next = [...rows];
                      next[mIdx] = { ...member, roleLabel: e.target.value };
                      setRows(next);
                    }}
                    placeholder="Optional"
                    className="h-10 rounded-none bg-background"
                    data-testid={`quest-participant-role-${mIdx}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>RESPONSIBILITY</label>
                  <div className="space-y-1.5 border border-border bg-background-2 p-2.5">
                    {member.responsibilities.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2">
                        <span className="text-xs text-neutral-11">•</span>
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => {
                            const next = [...rows];
                            const nextResp = [...member.responsibilities];
                            nextResp[bIdx] = e.target.value;
                            next[mIdx] = {
                              ...member,
                              responsibilities: nextResp,
                            };
                            setRows(next);
                          }}
                          placeholder="Concrete responsibility outcome…"
                          className="flex-1 bg-transparent text-[13px] text-foreground outline-none"
                        />
                        {member.responsibilities.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...rows];
                              next[mIdx] = {
                                ...member,
                                responsibilities:
                                  member.responsibilities.filter(
                                    (_, i) => i !== bIdx,
                                  ),
                              };
                              setRows(next);
                            }}
                            className="text-xs text-neutral-11 hover:text-foreground"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...rows];
                      next[mIdx] = {
                        ...member,
                        responsibilities: [...member.responsibilities, ''],
                      };
                      setRows(next);
                    }}
                    className="text-xs font-semibold text-neutral-11 hover:text-foreground"
                  >
                    + Add bullet
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ADD MEMBER card */}
        <div className="space-y-2.5 border border-border bg-background-2 p-3">
          <p className={LABEL_CLASS}>ADD PARTICIPANT</p>
          <div className="space-y-1">
            <label className={LABEL_CLASS}>PERSON</label>
            <QuestRosterCombobox
              members={memberCatalog}
              value={selectedPersonId}
              placeholder="Choose or search a participant…"
              onChange={(next) =>
                setSelectedPersonId(next ? String(next.id) : null)
              }
            />
          </div>
          <div className="space-y-1">
            <label className={LABEL_CLASS} htmlFor="quest-new-participant-role">
              ROLE
            </label>
            <Input
              id="quest-new-participant-role"
              value={newRoleLabel}
              maxLength={80}
              onChange={(e) => setNewRoleLabel(e.target.value)}
              placeholder="Optional"
              className="h-10 rounded-none bg-background"
              data-testid="quest-new-participant-role"
            />
          </div>
          <div className="space-y-1">
            <label className={LABEL_CLASS}>RESPONSIBILITY</label>
            <div className="space-y-1.5 border border-border bg-background p-2.5">
              {newBullets.map((b, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-neutral-11">•</span>
                  <input
                    type="text"
                    value={b}
                    onChange={(e) => {
                      const next = [...newBullets];
                      next[idx] = e.target.value;
                      setNewBullets(next);
                    }}
                    placeholder="First concrete responsibility…"
                    className="flex-1 bg-transparent text-[13px] text-foreground outline-none"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNewBullets([...newBullets, ''])}
              className="text-xs font-medium text-neutral-11 hover:text-foreground"
            >
              + Add bullet
            </button>
          </div>
          <Button
            type="button"
            colorVariant="neutral"
            onClick={handleAddMemberToQuest}
            disabled={!selectedPerson}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            Add to quest
          </Button>
        </div>
      </QuestEditDialogFrame>
    </Dialog>
  );
}

/**
 * Edit Deliverables modal (Figma node 54:25 — 02-edit-deliverables.png):
 * Only available on Active Quests; any Quest member can edit.
 */
export function EditQuestDeliverablesModal({
  open,
  onOpenChange,
  deliverables,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliverables: QuestDeliverableRecord[];
  onSave: (next: EditableQuestDeliverable[]) => void;
}) {
  const [rows, setRows] = useState<EditableQuestDeliverable[]>([]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (shouldResetQuestModalDraft(open, wasOpen)) {
      setRows(
        deliverables.length > 0
          ? deliverables.map((d) => ({
              id: d.id,
              name: d.name,
              url: d.url ?? '',
              note: d.note ?? '',
            }))
          : [{ name: '', url: '', note: '' }],
      );
    }
  }, [deliverables, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuestEditDialogFrame
        title="Edit deliverables"
        onClose={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onSave={() => {
          const cleaned = rows
            .map((r) => ({
              ...r,
              name: storedQuestPlainField(r.name),
              url: storedQuestPlainField(r.url),
              note: storedQuestPlainField(r.note),
            }))
            .filter((r) => r.name.length > 0);
          onSave(cleaned);
          onOpenChange(false);
        }}
      >
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="space-y-2 border border-border bg-background-2 p-3"
            >
              <div className="flex items-center justify-between">
                <span className={LABEL_CLASS}>DELIVERABLE {idx + 1}</span>
                <button
                  type="button"
                  onClick={() =>
                    setRows(rows.filter((_, itemIdx) => itemIdx !== idx))
                  }
                  className="text-[11px] font-semibold text-neutral-11 hover:text-foreground"
                >
                  Remove
                </button>
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>NAME</label>
                <Input
                  value={row.name}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...row, name: e.target.value };
                    setRows(next);
                  }}
                  placeholder="e.g. Space Context editor (8 sections)"
                  className="h-10 rounded-none bg-background"
                />
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>LINK (OPTIONAL)</label>
                <Input
                  value={row.url}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...row, url: e.target.value };
                    setRows(next);
                  }}
                  placeholder="https://github.com/..."
                  className="h-10 rounded-none bg-background"
                />
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>NOTE (OPTIONAL)</label>
                <Input
                  value={row.note}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...row, note: e.target.value };
                    setRows(next);
                  }}
                  placeholder="Short status or context note"
                  className="h-10 rounded-none bg-background"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRows([...rows, { name: '', url: '', note: '' }])}
          data-testid="add-deliverable-button"
          className="flex h-10 min-h-10 w-full items-center justify-center gap-1.5 border border-dashed border-border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-11 hover:border-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add deliverable
        </button>
      </QuestEditDialogFrame>
    </Dialog>
  );
}
