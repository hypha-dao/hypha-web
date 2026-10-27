'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TOKEN_PRICE_REFERENCE_CURRENCIES } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

import { isPersonRole, type PersonRole } from './person-badges';

const ROLES: PersonRole[] = ['member', 'builder', 'investor'];

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
  'w-full max-w-[62ch] border border-border bg-background px-2 py-1 text-2 leading-relaxed text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring';

function StoryLine({
  text,
  muted = false,
  canEdit,
  label,
  value,
  multiline = false,
  onSave,
}: {
  text: string;
  muted?: boolean;
  canEdit: boolean;
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const committed = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
    else committed.current = false;
  }, [editing, value]);

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
          'max-w-[62ch] rounded-none px-0.5 text-left text-2 leading-relaxed hover:bg-accent-2',
          muted ? 'text-neutral-11' : 'text-foreground',
        )}
      >
        {text}
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

  if (multiline) {
    return (
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
    );
  }

  return (
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
}

export function ProfileStory({
  person,
  isSelf,
  saving = false,
  error,
  onSave,
}: {
  person: ProfileStoryPerson;
  isSelf: boolean;
  saving?: boolean;
  error?: string | null;
  onSave?: (patch: ProfileStoryPatch) => Promise<void> | void;
}) {
  const t = useTranslations('Profile');
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
  const linkText = links
    .map((link) => {
      try {
        return new URL(link).hostname.replace(/^www\./, '');
      } catch {
        return link;
      }
    })
    .join(', ');

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        {canEdit && editingName ? (
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
            className="w-fit text-left text-7 leading-tight hover:bg-accent-2"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {displayName || t('story.nameLabel')}
          </button>
        ) : (
          <h2
            className="text-7 leading-tight"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {displayName}
          </h2>
        )}
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
      </header>

      <section
        aria-label={t('story.placeLabel')}
        className="flex flex-col gap-3"
      >
        {canEdit ? (
          <p className="max-w-[68ch] text-1 leading-relaxed text-neutral-11">
            {t('story.placeIntro')}
          </p>
        ) : role && displayName ? (
          <p className="max-w-[68ch] text-2 leading-relaxed text-foreground">
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
                    'border px-4 py-4 text-left transition-colors disabled:opacity-60',
                    selected
                      ? 'border-foreground'
                      : 'border-border hover:border-foreground',
                  )}
                >
                  <span
                    className="block text-3"
                    style={{ fontFamily: 'var(--font-family-heading)' }}
                  >
                    {roleTitle(option)}
                  </span>
                  <span className="mt-2 block text-1 leading-relaxed text-foreground">
                    {roleBody(option)}
                  </span>
                  <span className="mt-2 block text-1 leading-relaxed text-neutral-11">
                    {roleOpens(option)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <StoryLine
        text={person.networkOffer?.trim() || (canEdit ? offerPrompt : '')}
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

      <div className="flex flex-col gap-2">
        <StoryLine
          text={
            person.location?.trim()
              ? t('story.basedIn', { place: person.location.trim() })
              : canEdit
              ? t('story.basedInEmpty')
              : ''
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
            text={
              person.nickname?.trim()
                ? t(canEdit ? 'story.knownAs' : 'story.knownAsOther', {
                    nickname: person.nickname.trim(),
                  })
                : t('story.knownAsEmpty')
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
            text={
              person.email?.trim()
                ? t('story.reachYou', { email: person.email.trim() })
                : t('story.reachYouEmpty')
            }
            muted={!person.email?.trim()}
            canEdit
            label={t('editForm.labels.email')}
            value={person.email ?? ''}
            onSave={(email) => {
              if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
          text={
            linkText
              ? t('story.alsoAt', { links: linkText })
              : canEdit
              ? t('story.alsoAtEmpty')
              : ''
          }
          muted={!linkText}
          canEdit={canEdit}
          links={links}
          onSave={(next) => void save({ links: next })}
        />
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-4 text-1 text-neutral-11">
          <FileChoice
            label={t('story.changePicture')}
            onFile={(avatarFile) => void save({ avatarFile })}
          />
          <FileChoice
            label={t('story.changeBanner')}
            onFile={(leadFile) => void save({ leadFile })}
          />
        </div>
      ) : null}

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
    ? t('story.money', { currency: label || currency })
    : t('story.moneyEmpty');

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          'w-fit max-w-[62ch] text-left text-2 leading-relaxed hover:bg-accent-2',
          currency ? 'text-foreground' : 'text-neutral-11',
        )}
      >
        {text}
      </button>
    );
  }

  return (
    <select
      autoFocus
      aria-label={t('editForm.labels.preferredCurrency')}
      className={fieldClass}
      value={currency ?? ''}
      onChange={(event) => {
        setEditing(false);
        if (event.target.value) onSave(event.target.value);
      }}
      onBlur={() => setEditing(false)}
    >
      <option value="">{t('story.moneyEmpty')}</option>
      {TOKEN_PRICE_REFERENCE_CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {code} — {tCurrencies(code.toLowerCase())}
        </option>
      ))}
    </select>
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(links.join('\n'));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(links.join('\n'));
  }, [editing, links]);

  if (!text) return null;
  if (!canEdit) {
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
          'w-fit max-w-[62ch] text-left text-2 leading-relaxed hover:bg-accent-2',
          muted ? 'text-neutral-11' : 'text-foreground',
        )}
      >
        {text}
      </button>
    );
  }

  const commit = () => {
    const next = draft
      .split('\n')
      .map((line) => line.trim())
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
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setEditing(false);
    if (next.join('\n') !== links.join('\n')) onSave(next);
  };

  return (
    <>
      <textarea
        autoFocus
        aria-label={t('story.alsoAtEmpty')}
        value={draft}
        rows={3}
        className={fieldClass}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDraft(links.join('\n'));
            setInvalid(false);
            setEditing(false);
          }
        }}
      />
      {invalid ? (
        <p className="text-1 text-error-11" role="alert">
          {t('editForm.errors.urlInvalid')}
        </p>
      ) : null}
    </>
  );
}

function FileChoice({
  label,
  onFile,
}: {
  label: string;
  onFile: (file: File) => void;
}) {
  return (
    <label className="cursor-pointer underline-offset-4 hover:underline">
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
