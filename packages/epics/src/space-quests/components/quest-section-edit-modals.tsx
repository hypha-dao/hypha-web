'use client';

import {
  QUEST_DEFAULT_REWARD_TOKENS,
  QUEST_MILESTONE_STATUSES,
  bulletsToMarkdownList,
  splitMarkdownLinesToBullets,
  type Person,
  type QuestDeliverableRecord,
  type QuestMilestoneStatus,
  type QuestReward,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  RichTextEditor,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import { PersonAvatar } from '../../people/components/person-avatar';
import { SpaceMemberSelect } from '../../pipeline/components/space-member-select';

function keepMemberSelectPopoverOpen(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('[data-pipeline-select-content="true"]')) {
    event.preventDefault();
  }
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
    byId.set(person.id, person);
    knownNames.add(label.toLowerCase());
  }

  let syntheticId = -1;
  for (const raw of extraNames) {
    const clean = raw?.replace(/\s*\(you\)\s*/i, '').trim() ?? '';
    if (!clean || knownNames.has(clean.toLowerCase())) continue;
    knownNames.add(clean.toLowerCase());
    byId.set(syntheticId, {
      id: syntheticId,
      name: clean,
      surname: '',
    } as Person);
    syntheticId -= 1;
  }

  return [...byId.values()].sort((a, b) =>
    personRosterDisplayLabel(a, '').localeCompare(
      personRosterDisplayLabel(b, ''),
      undefined,
      { sensitivity: 'base' },
    ),
  );
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
    ?.replace(/\s*\(you\)\s*/i, '')
    .trim()
    .toLowerCase();
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
    <div className="flex items-center justify-end gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        colorVariant="neutral"
        className="h-10 rounded-none px-4 text-[11px] font-semibold uppercase tracking-[0.1em]"
        onClick={onCancel}
      >
        CANCEL
      </Button>
      <Button
        type="button"
        disabled={disabled}
        className="h-10 rounded-none bg-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-background hover:bg-foreground/90"
        onClick={onSave}
      >
        SAVE
      </Button>
    </div>
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
      <DialogContent
        hideCloseButton
        className="max-w-[520px] rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader title="Edit name" onClose={() => onOpenChange(false)} />
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>NAME</label>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Onboarding matcher"
              className="h-10 rounded-none bg-background-2"
            />
          </div>
          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              if (!draft.trim()) return;
              onSave(draft.trim());
              onOpenChange(false);
            }}
            disabled={!draft.trim()}
          />
        </div>
      </DialogContent>
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
      <DialogContent
        hideCloseButton
        className="max-w-[520px] rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader title="Edit goal" onClose={() => onOpenChange(false)} />
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>GOAL</label>
            <div className="border border-border bg-background">
              <RichTextEditor
                markdown={draft}
                onChange={setDraft}
                placeholder="Describe the quest goal…"
                bordered={false}
              />
            </div>
          </div>
          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              onSave(draft.trim());
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
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

  useEffect(() => {
    if (open) {
      setInMd(scopeInMarkdown?.trim() || bulletsToMarkdownList(scopeIn));
      setOutMd(scopeOutMarkdown?.trim() || bulletsToMarkdownList(scopeOut));
    }
  }, [open, scopeIn, scopeInMarkdown, scopeOut, scopeOutMarkdown]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-h-[90vh] max-w-[520px] overflow-y-auto rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader title="Edit scope" onClose={() => onOpenChange(false)} />
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>IN SCOPE</label>
            <div className="border border-border bg-background">
              <RichTextEditor
                markdown={inMd}
                onChange={setInMd}
                placeholder="• First item in scope…"
                bordered={false}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>OUT OF SCOPE</label>
            <div className="border border-border bg-background">
              <RichTextEditor
                markdown={outMd}
                onChange={setOutMd}
                placeholder="• First item out of scope…"
                bordered={false}
              />
            </div>
          </div>
          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              onSave({
                scopeIn: splitMarkdownLinesToBullets(inMd),
                scopeOut: splitMarkdownLinesToBullets(outMd),
                scopeInMarkdown: inMd.trim(),
                scopeOutMarkdown: outMd.trim(),
              });
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
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
      <DialogContent
        hideCloseButton
        className="max-w-[520px] rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit success criteria"
            onClose={() => onOpenChange(false)}
          />
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>SUCCESS CRITERIA</label>
            <div className="border border-border bg-background">
              <RichTextEditor
                markdown={draft}
                onChange={setDraft}
                placeholder="• Measurable outcome…"
                bordered={false}
              />
            </div>
          </div>
          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              onSave(draft.trim());
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
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
      buildMemberPersonCatalog(spaceMembers, [leadName, ...spaceMemberNames]),
    [leadName, spaceMemberNames, spaceMembers],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const match = findPersonInCatalog(catalog, {
      id: leadPersonId,
      name: leadName,
    });
    setSelectedId(
      match ? String(match.id) : catalog[0] ? String(catalog[0].id) : null,
    );
  }, [catalog, leadName, leadPersonId, open]);

  const selectedPerson = useMemo(
    () => findPersonInCatalog(catalog, { id: selectedId, name: leadName }),
    [catalog, leadName, selectedId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-[520px] rounded-none border border-border bg-background p-6"
        onPointerDownOutside={keepMemberSelectPopoverOpen}
        onInteractOutside={keepMemberSelectPopoverOpen}
        onFocusOutside={keepMemberSelectPopoverOpen}
      >
        <div className="space-y-4">
          <ModalHeader title="Edit lead" onClose={() => onOpenChange(false)} />
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>LEAD</label>
            <SpaceMemberSelect
              members={catalog}
              value={selectedId}
              onChange={(next) => setSelectedId(next)}
              allowUnassigned={false}
              popoverModal
              placeholder="Select a space member…"
              searchPlaceholder="Search members…"
              emptyListMessage="No space members found."
              unknownLabel="Space Member"
              className="h-11 bg-background-2"
            />
          </div>
          <ModalFooter
            disabled={!selectedPerson}
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              if (!selectedPerson) return;
              const label = personRosterDisplayLabel(
                selectedPerson,
                'Space Member',
              ).trim();
              if (!label) return;
              onSave(label, selectedPerson.id > 0 ? selectedPerson.id : null);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
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
      <DialogContent
        hideCloseButton
        className="max-w-[520px] rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit target date"
            onClose={() => onOpenChange(false)}
          />
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>TARGET DATE</label>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Jan 15, 2027"
              className="h-10 rounded-none bg-background-2"
            />
          </div>
          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              onSave(draft.trim() || null);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditQuestRewardsModal({
  open,
  onOpenChange,
  rewards,
  tokenSymbols = QUEST_DEFAULT_REWARD_TOKENS,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewards: QuestReward[];
  tokenSymbols?: readonly string[];
  onSave: (next: QuestReward[]) => void;
}) {
  const [rows, setRows] = useState<QuestReward[]>(rewards);

  useEffect(() => {
    if (open) {
      setRows(rewards.length > 0 ? rewards : [{ amount: '', token: 'USDC' }]);
    }
  }, [open, rewards]);

  const options = Array.from(
    new Set([...tokenSymbols, ...QUEST_DEFAULT_REWARD_TOKENS]),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-[520px] rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit quest reward"
            onClose={() => onOpenChange(false)}
          />
          <div className="space-y-2.5">
            <label className={LABEL_CLASS}>QUEST REWARD</label>
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={row.amount}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...row, amount: e.target.value };
                    setRows(next);
                  }}
                  placeholder="0"
                  className="h-9 w-44 rounded-none bg-background-2 font-mono text-sm"
                />
                <select
                  value={row.token}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...row, token: e.target.value };
                    setRows(next);
                  }}
                  className="h-9 w-32 border border-border bg-background-2 px-2.5 text-xs font-semibold text-foreground"
                >
                  {options.map((tok) => (
                    <option key={tok} value={tok}>
                      {tok}
                    </option>
                  ))}
                </select>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() =>
                    setRows(rows.filter((_, itemIdx) => itemIdx !== idx))
                  }
                  className="text-neutral-11 hover:text-foreground"
                  aria-label="Remove token row"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setRows([
                  ...rows,
                  {
                    amount: '',
                    token:
                      options.find(
                        (tok) => !rows.some((r) => r.token === tok),
                      ) ?? 'USDC',
                  },
                ])
              }
              className="inline-flex h-9 items-center border border-border bg-background px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground hover:bg-neutral-3"
            >
              + ADD TOKEN
            </button>
          </div>
          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              onSave(
                rows.filter(
                  (r) =>
                    r.amount.trim().length > 0 && r.token.trim().length > 0,
                ),
              );
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
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
  const [rows, setRows] = useState<EditableQuestMilestone[]>([]);

  useEffect(() => {
    if (open) {
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
  const defaultOwner = ownerCatalog[0] ?? null;
  const defaultOwnerName = defaultOwner
    ? personRosterDisplayLabel(defaultOwner, '').trim() || null
    : null;
  const defaultOwnerId =
    defaultOwner && defaultOwner.id > 0 ? defaultOwner.id : null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-none border border-border bg-background p-6"
        onPointerDownOutside={keepMemberSelectPopoverOpen}
        onInteractOutside={keepMemberSelectPopoverOpen}
        onFocusOutside={keepMemberSelectPopoverOpen}
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit milestones"
            subtitle="Hover between two milestones to insert one. They renumber automatically."
            onClose={() => onOpenChange(false)}
          />

          <div className="space-y-3">
            {rows.map((item, idx) => {
              const order = idx + 1;
              const renumberedLabel = item.insertedNew
                ? `M${order} · NEW — inserted after M${Math.max(1, order - 1)}`
                : item.wasOrder && item.wasOrder !== order
                ? `M${order} · was M${item.wasOrder} — renumbered automatically`
                : `M${order}`;

              return (
                <div key={idx} className="space-y-3">
                  {idx > 0 ? (
                    <div className="flex items-center gap-2 py-1">
                      <div className="h-px flex-1 border-t border-dashed border-[#3d3d8f]/50" />
                      <button
                        type="button"
                        onClick={() => insertAt(idx)}
                        data-testid={`insert-milestone-before-${order}`}
                        className={cn(
                          'rounded-full border border-dashed border-[#3d3d8f] px-3 py-1 text-[11px] font-semibold transition-colors',
                          item.insertedNew
                            ? 'border-solid bg-[#3d3d8f] text-white'
                            : 'bg-background text-[#3d3d8f] hover:bg-[#3d3d8f]/10',
                        )}
                      >
                        {item.insertedNew
                          ? 'Inserted here'
                          : '+ Add milestone here'}
                      </button>
                      <div className="h-px flex-1 border-t border-dashed border-[#3d3d8f]/50" />
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      'space-y-2.5 p-3',
                      item.insertedNew
                        ? 'rounded-[10px] border-[1.5px] border-[#3d3d8f] bg-[#f3f3fa] dark:bg-accent-2'
                        : 'border border-border bg-background',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-11">
                        {renumberedLabel}
                      </span>
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
                      <div className="flex-1 space-y-1">
                        <label className={LABEL_CLASS}>OWNER</label>
                        <SpaceMemberSelect
                          members={ownerCatalog}
                          value={(() => {
                            const matched = findPersonInCatalog(ownerCatalog, {
                              id: item.ownerPersonId,
                              name: item.ownerName,
                            });
                            return matched ? String(matched.id) : null;
                          })()}
                          onChange={(nextValue) => {
                            const matched = findPersonInCatalog(ownerCatalog, {
                              id: nextValue,
                            });
                            const next = [...rows];
                            next[idx] = {
                              ...item,
                              ownerPersonId:
                                matched && matched.id > 0 ? matched.id : null,
                              ownerName: matched
                                ? personRosterDisplayLabel(
                                    matched,
                                    'Space Member',
                                  ).trim() || null
                                : null,
                            };
                            setRows(next);
                          }}
                          allowUnassigned
                          unassignedLabel="Unassigned"
                          popoverModal
                          placeholder="Unassigned"
                          searchPlaceholder="Search members…"
                          emptyListMessage="No space members found."
                          unknownLabel="Space Member"
                          className="h-10 bg-background-2"
                        />
                      </div>
                      {showStatusSelect ? (
                        <div className="w-full space-y-1 sm:w-[150px]">
                          <label className={LABEL_CLASS}>STATUS</label>
                          <select
                            value={item.status}
                            onChange={(e) => {
                              const next = [...rows];
                              next[idx] = {
                                ...item,
                                status: e.target.value as QuestMilestoneStatus,
                              };
                              setRows(next);
                            }}
                            className="h-10 w-full border border-border bg-background-2 px-3 text-xs text-foreground"
                          >
                            {QUEST_MILESTONE_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st === 'done'
                                  ? 'Done'
                                  : st === 'in_progress'
                                  ? 'In progress'
                                  : 'Not started'}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>DESCRIPTION</label>
                      <div className="border border-border bg-background">
                        <RichTextEditor
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
            className="text-xs font-semibold text-[#3d3d8f] hover:underline"
          >
            + Add milestone at end
          </button>

          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              const cleaned = rows
                .map((r) => ({
                  ...r,
                  name: r.name.trim(),
                  dueDate: r.dueDate?.trim() || null,
                  ownerName: r.ownerName?.trim() || null,
                }))
                .filter((r) => r.name.length > 0);
              onSave(cleaned);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
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
  const [newRoleLabel, setNewRoleLabel] = useState('Member');
  const [newBullets, setNewBullets] = useState<string[]>(['']);

  const memberCatalog = useMemo(
    () =>
      buildMemberPersonCatalog(spaceMembers, [
        ...spaceMemberNames,
        ...members.map((m) => m.memberName),
      ]),
    [members, spaceMemberNames, spaceMembers],
  );

  useEffect(() => {
    if (open) {
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
      setNewRoleLabel('Member');
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
      'Space Member',
    ).trim();
    if (!cleanName) return;
    const bullets = newBullets.map((b) => b.trim()).filter(Boolean);
    setRows([
      ...rows,
      {
        personId: selectedPerson.id > 0 ? selectedPerson.id : null,
        memberName: cleanName,
        memberAvatarUrl: selectedPerson.avatarUrl ?? null,
        roleLabel: newRoleLabel.trim() || 'Member',
        responsibilities: bullets.length > 0 ? bullets : ['Core contributor'],
      },
    ]);
    setSelectedPersonId(null);
    setNewBullets(['']);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-none border border-border bg-background p-6"
        onPointerDownOutside={keepMemberSelectPopoverOpen}
        onInteractOutside={keepMemberSelectPopoverOpen}
        onFocusOutside={keepMemberSelectPopoverOpen}
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit members"
            subtitle="Who is on this quest, and what concrete outcomes each person owns (one bullet per outcome)."
            onClose={() => onOpenChange(false)}
          />

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
                      <p className="text-[11px] text-neutral-11">
                        {member.roleLabel || 'Member'}
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
            <p className={LABEL_CLASS}>ADD MEMBER</p>
            <div className="space-y-1">
              <label className={LABEL_CLASS}>PERSON</label>
              <SpaceMemberSelect
                members={memberCatalog}
                value={selectedPersonId}
                onChange={(next) => setSelectedPersonId(next)}
                allowUnassigned={false}
                popoverModal
                placeholder="Choose or search a space member…"
                searchPlaceholder="Search members…"
                emptyListMessage="No space members found."
                unknownLabel="Space Member"
                className="h-9 bg-background"
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
              onClick={handleAddMemberToQuest}
              disabled={!selectedPerson}
              className="h-9 rounded-none bg-foreground px-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-background"
            >
              ADD TO QUEST
            </Button>
          </div>

          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              const cleaned = rows
                .map((m) => ({
                  ...m,
                  memberName: m.memberName.trim(),
                  responsibilities: m.responsibilities
                    .map((r) => r.trim())
                    .filter(Boolean),
                }))
                .filter((m) => m.memberName.length > 0);
              onSave(cleaned);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
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

  useEffect(() => {
    if (open) {
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
      <DialogContent
        hideCloseButton
        className="max-h-[92vh] max-w-[520px] overflow-y-auto rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit deliverables"
            onClose={() => onOpenChange(false)}
          />

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
                    className="h-9 rounded-none bg-background"
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
                    className="h-9 rounded-none bg-background"
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
                    className="h-9 rounded-none bg-background"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRows([...rows, { name: '', url: '', note: '' }])}
            data-testid="add-deliverable-button"
            className="flex w-full items-center justify-center gap-1.5 border border-dashed border-border py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-11 hover:border-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
            ADD DELIVERABLE
          </button>

          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              const cleaned = rows
                .map((r) => ({
                  ...r,
                  name: r.name.trim(),
                  url: r.url.trim(),
                  note: r.note.trim(),
                }))
                .filter((r) => r.name.length > 0);
              onSave(cleaned);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
