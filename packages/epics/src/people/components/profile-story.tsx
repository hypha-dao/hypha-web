'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Pencil } from 'lucide-react';
import { TOKEN_PRICE_REFERENCE_CURRENCIES } from '@hypha-platform/core/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UploadLeadImage,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { Links } from '../../common/links';
import { isPersonRole, RoleGlyph, type PersonRole } from './person-badges';
import { PersonAvatar } from './person-avatar';

const ROLES: PersonRole[] = ['member', 'builder', 'investor'];

/** One @ and a dotted domain, with no whitespace. Kept off a regular
 * expression so a long dotted address cannot make the check backtrack. */
function isStoryEmail(value: string): boolean {
  const at = value.indexOf('@');
  if (at <= 0 || value.lastIndexOf('@') !== at) return false;
  const domain = value.slice(at + 1);
  const dot = domain.indexOf('.');
  if (dot <= 0 || dot >= domain.length - 1) return false;
  for (const char of value) {
    if (char.trim() === '') return false;
  }
  return true;
}

export type ProfileStoryPerson = {
  id: number;
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
  description?: string | null;
  location?: string | null;
  email?: string | null;
  links?: string[] | null;
  preferredCurrency?: string | null;
  primaryOrientation?: PersonRole | null;
  networkOffer?: string | null;
  slug?: string | null;
  avatarUrl?: string | null;
  leadImageUrl?: string | null;
};

export type ProfileStoryPatch = {
  name?: string;
  surname?: string;
  nickname?: string;
  description?: string;
  location?: string;
  email?: string;
  links?: string[];
  preferredCurrency?: string;
  primaryOrientation?: PersonRole;
  networkOffer?: string;
  avatarFile?: File;
  leadFile?: File;
};

const fieldClass =
  'w-full border border-border bg-background px-2 py-1 text-2 leading-relaxed text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring';

function StoryRow({
  label,
  text,
  muted = false,
  canEdit,
  editing = false,
  onEdit,
  editor,
}: {
  label: string;
  text: string;
  muted?: boolean;
  canEdit: boolean;
  editing?: boolean;
  onEdit?: () => void;
  editor?: ReactNode;
}) {
  if (!canEdit) {
    if (!text) return null;
    return (
      <div className="flex max-w-[62ch] flex-col gap-1 border-b border-border/60 py-3">
        <span className="text-1 text-neutral-11">{label}</span>
        <span className="whitespace-pre-line text-2 leading-6 text-foreground">
          {text}
        </span>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex max-w-[62ch] flex-col gap-2 border-b border-border/60 py-3">
        <span className="text-1 text-neutral-11">{label}</span>
        {editor}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full max-w-[62ch] items-start justify-between gap-4 border-b border-border/60 py-3 text-left hover:bg-accent-2"
    >
      <span className="min-w-0">
        <span className="block text-1 text-neutral-11">{label}</span>
        <span
          className={cn(
            'mt-1 block whitespace-pre-line text-2 leading-6',
            muted ? 'text-neutral-11' : 'text-foreground',
          )}
        >
          {text}
        </span>
      </span>
      <Pencil className="mt-1 size-3.5 shrink-0 text-neutral-11" aria-hidden />
    </button>
  );
}

function StoryLine({
  text,
  muted = false,
  canEdit,
  label,
  value,
  multiline = false,
  row = false,
  onSave,
}: {
  text: string;
  muted?: boolean;
  canEdit: boolean;
  label: string;
  value: string;
  multiline?: boolean;
  row?: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const committed = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
    else committed.current = false;
  }, [editing, value]);

  if (row && !editing) {
    return (
      <StoryRow
        label={label}
        text={text}
        muted={muted}
        canEdit={canEdit}
        onEdit={() => setEditing(true)}
      />
    );
  }

  if (!canEdit) {
    if (!text) return null;
    return (
      <p className="max-w-[62ch] text-2 leading-relaxed text-foreground">
        {text}
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          'inline-flex max-w-[62ch] items-start gap-2 rounded-none px-0.5 text-left text-2 leading-relaxed hover:bg-accent-2',
          muted ? 'text-neutral-11' : 'text-foreground',
        )}
      >
        <span>{text}</span>
        <Pencil
          className="mt-1 size-3.5 shrink-0 text-neutral-11"
          aria-hidden
        />
      </button>
    );
  }

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    setEditing(false);
    if (draft.trim() !== value.trim()) onSave(draft.trim());
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const editor = multiline ? (
    <textarea
      autoFocus
      aria-label={label}
      value={draft}
      rows={3}
      className={fieldClass}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel();
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      }}
    />
  ) : (
    <input
      autoFocus
      aria-label={label}
      value={draft}
      className={fieldClass}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') cancel();
      }}
    />
  );

  if (row) {
    return (
      <StoryRow label={label} text={text} canEdit editing editor={editor} />
    );
  }

  return editor;
}

export function ProfileStory({
  person,
  isSelf,
  saving = false,
  error,
  actions,
  afterHeader,
  onSave,
}: {
  person: ProfileStoryPerson;
  isSelf: boolean;
  saving?: boolean;
  error?: string | null;
  actions?: ReactNode;
  afterHeader?: ReactNode;
  onSave?: (patch: ProfileStoryPatch) => Promise<void> | void;
}) {
  const t = useTranslations('Profile');
  const tCommon = useTranslations('Common');
  const tWelcome = useTranslations('WelcomeFlow');
  const tCurrencies = useTranslations(
    'AgreementFlow.plugins.issueNewToken.value.currencies',
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState({
    name: person.name ?? '',
    surname: person.surname ?? '',
  });
  const [editingName, setEditingName] = useState(false);
  const nameCommitted = useRef(false);

  useEffect(() => {
    if (!editingName) {
      setNameDraft({ name: person.name ?? '', surname: person.surname ?? '' });
    }
  }, [editingName, person.name, person.surname]);

  const role = isPersonRole(person.primaryOrientation)
    ? person.primaryOrientation
    : null;
  const fullName = [person.name, person.surname]
    .filter(Boolean)
    .join(' ')
    .trim();
  const displayName = fullName || person.nickname?.trim() || '';
  const canEdit = Boolean(isSelf && onSave);

  const save = async (patch: ProfileStoryPatch) => {
    if (!onSave) return;
    setLocalError(null);
    try {
      await onSave(patch);
    } catch (reason) {
      setLocalError(
        reason instanceof Error ? reason.message : t('story.saving'),
      );
    }
  };

  const commitName = () => {
    if (nameCommitted.current) return;
    nameCommitted.current = true;
    setEditingName(false);
    const name = nameDraft.name.trim();
    const surname = nameDraft.surname.trim();
    if (!name) {
      setLocalError(t('editForm.errors.firstNameRequired'));
      return;
    }
    if (!surname) {
      setLocalError(t('editForm.errors.lastNameRequired'));
      return;
    }
    if (name === (person.name ?? '') && surname === (person.surname ?? '')) {
      return;
    }
    void save({ name, surname });
  };

  const roleTitle = (option: PersonRole) =>
    tWelcome(`orientation.${option}.title`);
  const roleBody = (option: PersonRole) =>
    tWelcome(`orientation.${option}.body`);
  const roleOpens = (option: PersonRole) =>
    t(
      option === 'member'
        ? 'story.memberOpens'
        : option === 'builder'
        ? 'story.builderOpens'
        : 'story.investorOpens',
    );

  const offerPrompt = role ? tWelcome(`offer.${role}`) : t('story.offerLabel');
  const currency = TOKEN_PRICE_REFERENCE_CURRENCIES.find(
    (code) => code === person.preferredCurrency,
  );
  const currencyLabel = currency ? tCurrencies(currency.toLowerCase()) : '';
  const links = (person.links ?? []).filter(Boolean);
  const linkText = links.join('\n');

  const cropDialogLabels = {
    title: tCommon('uploadLeadImage.cropTitle'),
    description: tCommon('uploadLeadImage.cropDescription'),
    cancel: tCommon('uploadLeadImage.cancel'),
    confirm: tCommon('uploadLeadImage.confirm'),
  };
  const uploadMessages = {
    dropHere: tCommon('uploadLeadImage.dropHere'),
    fileTooLarge: tCommon('uploadLeadImage.fileTooLarge'),
    uploadFailed: tCommon('uploadLeadImage.uploadFailed'),
  };
  const leadImage = person.leadImageUrl?.trim() || '';
  const avatarImage = person.avatarUrl?.trim() || '';

  const nameBlock =
    canEdit && editingName ? (
      <div
        className="flex max-w-[62ch] flex-wrap gap-2"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            commitName();
          }
        }}
      >
        <input
          autoFocus
          aria-label={t('editForm.placeholders.firstName')}
          value={nameDraft.name}
          className={fieldClass}
          onChange={(event) =>
            setNameDraft((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitName();
            }
          }}
        />
        <input
          aria-label={t('editForm.placeholders.lastName')}
          value={nameDraft.surname}
          className={fieldClass}
          onChange={(event) =>
            setNameDraft((current) => ({
              ...current,
              surname: event.target.value,
            }))
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitName();
            }
          }}
        />
      </div>
    ) : canEdit ? (
      <button
        type="button"
        onClick={() => {
          nameCommitted.current = false;
          setEditingName(true);
        }}
        className="inline-flex w-fit items-center gap-2 text-left text-7 leading-tight hover:bg-accent-2"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        <span>{displayName || t('story.nameLabel')}</span>
        <Pencil className="size-3.5 shrink-0 text-neutral-11" aria-hidden />
      </button>
    ) : (
      <h2
        className="text-7 leading-tight"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {displayName}
      </h2>
    );

  return (
    <article className="flex flex-col gap-10">
      {canEdit ? (
        <UploadLeadImage
          defaultImage={leadImage || null}
          enableImageResizer
          uploadText={t('story.changeBanner')}
          cropDialogLabels={cropDialogLabels}
          messages={uploadMessages}
          className="rounded-none"
          onChange={(file) => {
            if (file) void save({ leadFile: file });
          }}
        />
      ) : leadImage ? (
        <img
          src={leadImage}
          alt=""
          className="aspect-[762/270] w-full object-cover"
        />
      ) : null}
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-4">
            {canEdit ? (
              <div className="w-16 shrink-0">
                <UploadLeadImage
                  defaultImage={avatarImage || null}
                  enableImageResizer
                  aspectRatio={1}
                  uploadText={t('story.changePicture')}
                  cropDialogLabels={cropDialogLabels}
                  messages={uploadMessages}
                  className="rounded-full"
                  imageClassName="object-cover"
                  onChange={(file) => {
                    if (file) void save({ avatarFile: file });
                  }}
                />
              </div>
            ) : (
              <PersonAvatar
                avatarSrc={avatarImage || undefined}
                userName={displayName}
                size="lg"
                shape="circle"
              />
            )}
            <div className="flex min-w-0 flex-col gap-1.5">
              {nameBlock}
              <StoryLine
                text={
                  person.description?.trim() ||
                  (canEdit ? t('story.descriptionEmpty') : '')
                }
                muted={!person.description?.trim()}
                canEdit={canEdit}
                label={t('story.descriptionEmpty')}
                value={person.description ?? ''}
                multiline
                onSave={(description) => {
                  if (description.length > 300) {
                    setLocalError(t('editForm.errors.descriptionMaxLength'));
                    return;
                  }
                  void save({ description });
                }}
              />
            </div>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {actions}
            </div>
          ) : null}
        </div>
        {afterHeader}
      </header>

      <section
        aria-label={t('story.placeLabel')}
        className="flex flex-col gap-5"
      >
        {canEdit ? (
          <p className="max-w-[58ch] text-2 leading-7 text-neutral-11">
            {t('story.placeIntro')}
          </p>
        ) : role && displayName ? (
          <p className="max-w-[58ch] text-2 leading-7 text-foreground">
            {t('story.showsUp', { name: displayName, role: roleTitle(role) })}{' '}
            {roleBody(role)}
          </p>
        ) : null}
        {canEdit ? (
          <div className="grid gap-3 md:grid-cols-3">
            {ROLES.map((option) => {
              const selected = option === role;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  disabled={saving}
                  onClick={() => {
                    if (option !== role)
                      void save({ primaryOrientation: option });
                  }}
                  className={cn(
                    'flex flex-col gap-3 border px-4 py-4 text-left transition-colors disabled:opacity-60',
                    selected
                      ? 'border-foreground bg-accent-2'
                      : 'border-border hover:border-foreground/45',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center text-foreground">
                      <RoleGlyph role={option} size={28} />
                    </span>
                    <span
                      className="min-w-0 flex-1 text-3 leading-none"
                      style={{ fontFamily: 'var(--font-family-heading)' }}
                    >
                      {roleTitle(option)}
                    </span>
                    {selected ? (
                      <span
                        className="inline-flex size-6 shrink-0 items-center justify-center border border-foreground text-foreground"
                        title={t('story.selected')}
                        aria-label={t('story.selected')}
                      >
                        <Check className="size-3.5" aria-hidden />
                      </span>
                    ) : (
                      <span
                        className="size-6 shrink-0 border border-border"
                        aria-hidden
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-2 leading-snug',
                      selected ? 'text-foreground' : 'text-neutral-11',
                    )}
                  >
                    {roleBody(option)}
                  </span>
                  <span className="border-t border-border/70 pt-3 text-1 leading-snug text-neutral-11">
                    {roleOpens(option)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <StoryLine
        row
        text={
          person.networkOffer?.trim() ||
          (canEdit ? tWelcome('offer.placeholder') : '')
        }
        muted={!person.networkOffer?.trim()}
        canEdit={canEdit}
        label={offerPrompt}
        value={person.networkOffer ?? ''}
        multiline
        onSave={(networkOffer) => {
          if (networkOffer.length > 500) {
            setLocalError(t('story.offerTooLong'));
            return;
          }
          void save({ networkOffer });
        }}
      />

      <div className="flex max-w-[62ch] flex-col">
        <StoryLine
          row
          text={
            person.location?.trim() || (canEdit ? t('story.basedInEmpty') : '')
          }
          muted={!person.location?.trim()}
          canEdit={canEdit}
          label={t('editForm.labels.location')}
          value={person.location ?? ''}
          onSave={(location) => {
            if (location.length > 100) {
              setLocalError(t('editForm.errors.locationMaxLength'));
              return;
            }
            void save({ location });
          }}
        />
        {(person.nickname?.trim() || canEdit) && (
          <StoryLine
            row
            text={
              person.nickname?.trim() ||
              (canEdit ? t('story.knownAsEmpty') : '')
            }
            muted={!person.nickname?.trim()}
            canEdit={canEdit}
            label={t('editForm.placeholders.nickname')}
            value={person.nickname ?? ''}
            onSave={(nickname) => {
              if (!nickname) {
                setLocalError(t('editForm.errors.nicknameRequired'));
                return;
              }
              if (nickname.length > 12) {
                setLocalError(t('editForm.errors.nicknameMaxLength'));
                return;
              }
              void save({ nickname });
            }}
          />
        )}
        {canEdit ? (
          <StoryLine
            row
            text={
              person.email?.trim() || (canEdit ? t('story.reachYouEmpty') : '')
            }
            muted={!person.email?.trim()}
            canEdit
            label={t('editForm.labels.email')}
            value={person.email ?? ''}
            onSave={(email) => {
              if (email && !isStoryEmail(email)) {
                setLocalError(t('editForm.errors.emailInvalid'));
                return;
              }
              if (email.length > 100) {
                setLocalError(t('editForm.errors.emailMaxLength'));
                return;
              }
              void save({ email });
            }}
          />
        ) : null}
        {canEdit ? (
          <CurrencyLine
            currency={currency}
            label={currencyLabel}
            onSave={(preferredCurrency) => void save({ preferredCurrency })}
          />
        ) : null}
        <LinksLine
          text={linkText || (canEdit ? t('story.alsoAtEmpty') : '')}
          muted={!linkText}
          canEdit={canEdit}
          links={links}
          onSave={(next) => void save({ links: next })}
        />
      </div>

      {saving ? (
        <p className="text-1 text-neutral-11">{t('story.saving')}</p>
      ) : null}
      {localError || error ? (
        <p className="text-1 text-error-11" role="alert">
          {localError || error}
        </p>
      ) : null}
    </article>
  );
}

function CurrencyLine({
  currency,
  label,
  onSave,
}: {
  currency?: string;
  label: string;
  onSave: (code: string) => void;
}) {
  const t = useTranslations('Profile');
  const tCurrencies = useTranslations(
    'AgreementFlow.plugins.issueNewToken.value.currencies',
  );
  const [editing, setEditing] = useState(false);
  const text = currency
    ? `${currency}${label ? ` — ${label}` : ''}`
    : t('story.moneyEmpty');
  const editor = (
    <Select
      value={currency || undefined}
      open
      onOpenChange={(open) => {
        if (!open) setEditing(false);
      }}
      onValueChange={(value) => {
        setEditing(false);
        if (value) onSave(value);
      }}
    >
      <SelectTrigger
        aria-label={t('editForm.labels.preferredCurrency')}
        className="w-full max-w-sm"
      >
        <SelectValue placeholder={t('story.moneyEmpty')} />
      </SelectTrigger>
      <SelectContent>
        {TOKEN_PRICE_REFERENCE_CURRENCIES.map((code) => (
          <SelectItem key={code} value={code}>
            {code} — {tCurrencies(code.toLowerCase())}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <StoryRow
      label={t('editForm.labels.preferredCurrency')}
      text={text}
      muted={!currency}
      canEdit
      editing={editing}
      onEdit={() => setEditing(true)}
      editor={editor}
    />
  );
}

function LinksLine({
  text,
  muted,
  canEdit,
  links,
  onSave,
}: {
  text: string;
  muted: boolean;
  canEdit: boolean;
  links: string[];
  onSave: (links: string[]) => void;
}) {
  const t = useTranslations('Profile');
  const tSpaces = useTranslations('Spaces');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(links);
  const [invalid, setInvalid] = useState(false);
  const committed = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(links);
      committed.current = false;
    }
  }, [editing, links]);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    const next = draft
      .map((link) => link.trim())
      .filter(Boolean)
      .slice(0, 3);
    const invalidLink = next.find((link) => {
      try {
        const url = new URL(link);
        return url.protocol !== 'https:' && url.protocol !== 'http:';
      } catch {
        return true;
      }
    });
    if (invalidLink) {
      committed.current = false;
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setEditing(false);
    if (next.join('\n') !== links.join('\n')) onSave(next);
  };

  return (
    <StoryRow
      label={t('story.linksLabel')}
      text={text}
      muted={muted}
      canEdit={canEdit}
      editing={editing}
      onEdit={() => setEditing(true)}
      editor={
        <div
          className="flex flex-col gap-2"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              commit();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft(links);
              setInvalid(false);
              setEditing(false);
            }
          }}
        >
          <Links
            links={draft}
            onChange={setDraft}
            placeholder={tSpaces('addYourUrl')}
          />
          {invalid ? (
            <p className="text-1 text-error-11" role="alert">
              {t('editForm.errors.urlInvalid')}
            </p>
          ) : null}
        </div>
      }
    />
  );
}
