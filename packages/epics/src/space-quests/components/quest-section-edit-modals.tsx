'use client';

import {
  QUEST_DEFAULT_REWARD_TOKENS,
  QUEST_MILESTONE_STATUSES,
  bulletsToMarkdownList,
  splitMarkdownLinesToBullets,
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
import { useEffect, useState } from 'react';

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
          <ModalHeader
            title="Edit name"
            subtitle="Opened by clicking the Name section of the draft."
            onClose={() => onOpenChange(false)}
          />
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
          <ModalHeader
            title="Edit goal"
            subtitle="Same RichTextEditor as proposal create (packages/ui)."
            onClose={() => onOpenChange(false)}
          />
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
          <ModalHeader
            title="Edit scope"
            subtitle="In / Out of scope use the same RichTextEditor as proposals."
            onClose={() => onOpenChange(false)}
          />
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
            subtitle="Bullets and formatting via RichTextEditor (proposal create)."
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
  spaceMemberNames,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  spaceMemberNames: string[];
  onSave: (nextLeadName: string) => void;
}) {
  const [selected, setSelected] = useState(leadName);
  useEffect(() => {
    if (open) setSelected(leadName);
  }, [leadName, open]);

  const candidates = Array.from(
    new Set([leadName, ...spaceMemberNames].filter(Boolean)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-[520px] rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit lead"
            subtitle="Opened by clicking the Lead section of the draft."
            onClose={() => onOpenChange(false)}
          />
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>LEAD</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-11 w-full border border-border bg-background-2 px-3 text-sm font-medium text-foreground"
            >
              {candidates.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => {
              if (!selected.trim()) return;
              onSave(selected.trim());
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
            subtitle="Opened by clicking the Target date section of the draft."
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
            subtitle="Multi-token amount and token selection."
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
  spaceMemberNames,
  showStatusSelect = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestones: EditableQuestMilestone[];
  spaceMemberNames: string[];
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

  const ownerCandidates = Array.from(
    new Set([
      ...spaceMemberNames,
      ...rows.map((r) => r.ownerName).filter((v): v is string => Boolean(v)),
    ]),
  );

  const insertAt = (index: number) => {
    setRows((current) => {
      const next = [...current];
      next.splice(index, 0, {
        name: '',
        description: '',
        dueDate: '',
        ownerName: ownerCandidates[0] ?? null,
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
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit milestones"
            subtitle="Opened by clicking the Milestones section of the draft. Each milestone has a name, owner, and a rich description. Hover between two milestones to insert one there — order (M1, M2, M3…) renumbers automatically."
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
                        <select
                          value={item.ownerName ?? ''}
                          onChange={(e) => {
                            const next = [...rows];
                            next[idx] = {
                              ...item,
                              ownerName: e.target.value || null,
                            };
                            setRows(next);
                          }}
                          className="h-10 w-full border border-border bg-background-2 px-3 text-xs text-foreground"
                        >
                          <option value="">Unassigned</option>
                          {ownerCandidates.map((owner) => (
                            <option key={owner} value={owner}>
                              {owner}
                            </option>
                          ))}
                        </select>
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
                  ownerName: ownerCandidates[0] ?? null,
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
  spaceMemberNames,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: EditableQuestMember[];
  spaceMemberNames: string[];
  onSave: (next: EditableQuestMember[]) => void;
}) {
  const [rows, setRows] = useState<EditableQuestMember[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('Member');
  const [newBullets, setNewBullets] = useState<string[]>(['']);

  useEffect(() => {
    if (open) {
      setRows(
        members.map((m) => ({
          ...m,
          responsibilities:
            m.responsibilities.length > 0 ? [...m.responsibilities] : [''],
        })),
      );
      setNewPersonName('');
      setNewRoleLabel('Member');
      setNewBullets(['']);
    }
  }, [members, open]);

  const candidateNames = Array.from(new Set([...spaceMemberNames, 'Ben O.']));

  const handleAddMemberToQuest = () => {
    const cleanName = newPersonName.trim();
    if (!cleanName) return;
    const bullets = newBullets.map((b) => b.trim()).filter(Boolean);
    setRows([
      ...rows,
      {
        memberName: cleanName,
        roleLabel: newRoleLabel.trim() || 'Member',
        responsibilities: bullets.length > 0 ? bullets : ['Core contributor'],
      },
    ]);
    setNewPersonName('');
    setNewBullets(['']);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-none border border-border bg-background p-6"
      >
        <div className="space-y-4">
          <ModalHeader
            title="Edit members"
            subtitle="Who is on this quest, and what concrete outcomes each person owns (one bullet per outcome)."
            onClose={() => onOpenChange(false)}
          />

          <div className="space-y-2.5">
            {rows.map((member, mIdx) => {
              const initial = (
                member.memberName.trim()[0] ?? 'M'
              ).toUpperCase();
              return (
                <div
                  key={mIdx}
                  className="space-y-2 border border-border bg-background p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center bg-foreground text-[11px] font-bold text-background">
                      {initial}
                    </span>
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
              <Input
                list="quest-space-member-options"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Choose or search a space member…"
                className="h-9 rounded-none bg-background"
              />
              <datalist id="quest-space-member-options">
                {candidateNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
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
              disabled={!newPersonName.trim()}
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
            subtitle="Any member can edit. Changes also apply from Steward chat."
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
