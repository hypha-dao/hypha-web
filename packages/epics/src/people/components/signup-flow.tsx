'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Button,
  Input,
  LanguageSelect,
  Logo,
  Textarea,
  UploadAvatar,
} from '@hypha-platform/ui';
import {
  localeMetadata,
  routing,
  type Locale,
} from '@hypha-platform/i18n/client';
import { cn } from '@hypha-platform/ui-utils';

import { PersonRoleBadge } from './person-badges';

export type SignupOrientation = 'member' | 'builder' | 'investor';

export type SignupFlowValues = {
  name: string;
  surname: string;
  nickname: string;
  description: string;
  email?: string;
  address?: string;
  links: string[];
  location?: string;
  avatarUrl?: File;
  leadImageUrl?: File;
  primaryOrientation: SignupOrientation;
  networkOffer: string;
};

type SignupFlowProps = {
  email?: string;
  walletAddress?: string;
  /** True only while Privy is still starting. A signed-in account with no wallet is not loading. */
  authLoading?: boolean;
  isCreating?: boolean;
  error?: string | null;
  onComplete: (values: SignupFlowValues) => Promise<void>;
};

function profileCreateErrorText(
  message: string,
  t: ReturnType<typeof useTranslations<'WelcomeFlow'>>,
): string {
  switch (message) {
    case 'nickname_taken':
      return t('errors.nicknameTaken');
    case 'email_taken':
      return t('errors.emailTaken');
    case 'profile_create_failed':
      return t('errors.createFailed');
    default:
      return message;
  }
}

const STEPS = ['welcome', 'you', 'description', 'orientation'] as const;
type Step = (typeof STEPS)[number];

const ORIENTATIONS: SignupOrientation[] = ['member', 'builder', 'investor'];

/** Ink on paper. Space accent remaps `bg-accent-9` to a hue; these actions stay achromatic. */
const primaryActionClassName =
  '!bg-foreground !text-background hover:!bg-foreground hover:!text-background';

/** Same open surface as the orientation cards: border only, mycelium shows through. */
const signupFieldClassName = 'bg-transparent';

export function SignupFlow({
  email,
  walletAddress,
  authLoading = false,
  isCreating,
  error,
  onComplete,
}: SignupFlowProps) {
  const t = useTranslations('WelcomeFlow');
  const tProfile = useTranslations('Profile');
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<File | null>(null);
  const [location, setLocation] = useState('');
  const [orientation, setOrientation] = useState<SignupOrientation | null>(
    null,
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  const index = STEPS.indexOf(step);

  const youError = () => {
    if (!name.trim()) return tProfile('editForm.errors.firstNameRequired');
    if (!surname.trim()) return tProfile('editForm.errors.lastNameRequired');
    const nick = nickname.trim();
    if (!nick) return tProfile('editForm.errors.nicknameRequired');
    if (nick.length > 12) return tProfile('editForm.errors.nicknameMaxLength');
    return null;
  };

  const descriptionError = () => {
    if (description.trim().length > 300) {
      return tProfile('editForm.errors.descriptionMaxLength');
    }
    if (location.trim().length > 100) {
      return tProfile('editForm.errors.locationMaxLength');
    }
    return null;
  };

  const goNext = () => {
    setFieldError(null);
    if (step === 'you') {
      const message = youError();
      if (message) {
        setFieldError(message);
        return;
      }
    }
    if (step === 'description') {
      const message = descriptionError();
      if (message) {
        setFieldError(message);
        return;
      }
    }
    const next = STEPS[index + 1];
    if (next) setStep(next);
  };

  const finish = async () => {
    if (!orientation || authLoading || isCreating) return;
    const identityError = youError();
    if (identityError) {
      setFieldError(identityError);
      setStep('you');
      return;
    }
    const placeError = descriptionError();
    if (placeError) {
      setFieldError(placeError);
      setStep('description');
      return;
    }
    setFieldError(null);
    try {
      const trimmedLocation = location.trim();
      const trimmedDescription = description.trim();
      const accountEmail = email?.trim();
      await onComplete({
        name: name.trim(),
        surname: surname.trim(),
        nickname: nickname.trim(),
        description: trimmedDescription,
        email: accountEmail || undefined,
        address: walletAddress || undefined,
        links: [],
        location: trimmedLocation || undefined,
        avatarUrl: avatarUrl ?? undefined,
        primaryOrientation: orientation,
        networkOffer: '',
      });
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : String(err));
    }
  };

  const shownError = fieldError || error;

  const youStep = step === 'you';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-background text-foreground',
        youStep ? 'overflow-hidden' : 'overflow-y-auto',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-[center_right] opacity-50 dark:opacity-30"
        style={{ backgroundImage: 'url(/brand/mycelium.jpg)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/92 to-background/35"
      />
      <div
        className={cn(
          'relative flex w-full flex-col',
          youStep ? 'h-dvh' : 'min-h-dvh',
        )}
      >
        <div className="absolute top-4 right-4 z-10">
          <SignupLanguageSelect />
        </div>
        <div
          className={cn(
            'mx-auto my-auto flex w-full max-w-xl flex-col items-center px-6 text-center',
            youStep ? 'py-4' : 'py-8',
          )}
        >
          <Logo width={96} />
          <p
            className={cn(
              'w-full text-1 text-neutral-11',
              youStep ? 'mt-3' : 'mt-4',
            )}
          >
            {t('step', { current: index + 1, total: STEPS.length })}
          </p>
          <div className="mt-2 flex w-full justify-center gap-1" aria-hidden>
            {STEPS.map((item, itemIndex) => (
              <span
                key={item}
                className={cn(
                  'h-0.5 w-8 bg-neutral-6',
                  itemIndex <= index && 'bg-foreground',
                )}
              />
            ))}
          </div>

          <div className={cn('w-full', youStep ? 'mt-4' : 'mt-10')}>
            {step === 'welcome' ? (
              <Screen
                eyebrow={t('welcome.eyebrow')}
                title={t('welcome.title')}
                body={t('welcome.body')}
              />
            ) : null}

            {step === 'you' ? (
              <Screen title={t('you.title')} compact>
                <div className="flex items-start gap-4">
                  <div className="grid shrink-0 justify-items-center gap-2">
                    <span className="text-1 text-neutral-11">
                      {t('you.icon')}
                    </span>
                    <UploadAvatar
                      onChange={setAvatarUrl}
                      className="!h-16 !min-h-16 !w-16 !min-w-16 !rounded-none"
                    />
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <Field label={t('you.firstName')}>
                      <Input
                        value={name}
                        autoComplete="given-name"
                        required
                        className={signupFieldClassName}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </Field>
                    <Field label={t('you.lastName')}>
                      <Input
                        value={surname}
                        autoComplete="family-name"
                        required
                        className={signupFieldClassName}
                        onChange={(event) => setSurname(event.target.value)}
                      />
                    </Field>
                    <Field
                      label={t('you.nickname')}
                      hint={t('you.nicknameHint')}
                    >
                      <Input
                        value={nickname}
                        maxLength={12}
                        autoComplete="username"
                        required
                        className={signupFieldClassName}
                        onChange={(event) => setNickname(event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </Screen>
            ) : null}

            {step === 'description' ? (
              <Screen
                title={t('description.title')}
                body={t('description.body')}
              >
                <Field label={t('description.passion')}>
                  <Textarea
                    value={description}
                    maxLength={300}
                    rows={3}
                    placeholder={t('description.passionPlaceholder')}
                    className={signupFieldClassName}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
                <Field label={t('description.location')}>
                  <Input
                    value={location}
                    maxLength={100}
                    placeholder={t('description.locationPlaceholder')}
                    className={signupFieldClassName}
                    onChange={(event) => setLocation(event.target.value)}
                  />
                </Field>
              </Screen>
            ) : null}

            {step === 'orientation' ? (
              <Screen
                title={t('orientation.title')}
                body={t('orientation.body')}
              >
                <div className="grid w-full gap-3">
                  {ORIENTATIONS.map((option) => {
                    const selected = orientation === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setOrientation(option)}
                        className={cn(
                          'border px-4 py-4 text-left transition-colors',
                          selected
                            ? 'border-foreground'
                            : 'border-border hover:border-neutral-8',
                        )}
                      >
                        <PersonRoleBadge role={option} />
                        <span
                          className="mt-3 block text-3"
                          style={{ fontFamily: 'var(--font-family-heading)' }}
                        >
                          {t(`orientation.${option}.title`)}
                        </span>
                        <span className="mt-1 block text-2 leading-relaxed text-neutral-11">
                          {t(`orientation.${option}.body`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Screen>
            ) : null}
          </div>

          {authLoading ? (
            <p className="mt-3 w-full text-1 text-neutral-11">
              {t('walletWait')}
            </p>
          ) : null}
          {shownError ? (
            <p className="mt-4 w-full text-2 text-error-11" role="alert">
              {profileCreateErrorText(shownError, t)}
            </p>
          ) : null}

          <div
            className={cn(
              'flex w-full flex-nowrap items-center gap-3',
              youStep ? 'mt-4' : 'mt-6',
            )}
          >
            {index > 0 ? (
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                className="shrink-0"
                disabled={isCreating}
                onClick={() => {
                  setFieldError(null);
                  const previous = STEPS[index - 1];
                  if (previous) setStep(previous);
                }}
              >
                {t('back')}
              </Button>
            ) : null}
            {step === 'welcome' ? (
              <Button
                type="button"
                className={cn(primaryActionClassName, 'min-w-0 flex-1')}
                disabled={authLoading}
                onClick={goNext}
              >
                {authLoading ? t('walletWait') : t('begin')}
              </Button>
            ) : null}
            {step === 'you' || step === 'description' ? (
              <Button
                type="button"
                className={cn(primaryActionClassName, 'min-w-0 flex-1')}
                onClick={goNext}
              >
                {t('continue')}
              </Button>
            ) : null}
            {step === 'orientation' ? (
              <Button
                type="button"
                className={cn(primaryActionClassName, 'min-w-0 flex-1')}
                disabled={!orientation || isCreating || authLoading}
                onClick={() => {
                  void finish();
                }}
              >
                {isCreating
                  ? t('saving')
                  : authLoading
                  ? t('walletWait')
                  : t('enterHypha')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignupLanguageSelect() {
  const tCommon = useTranslations('Common');
  const pathname = usePathname();
  const intlLocale = useLocale();
  const pathLocale = useMemo(() => {
    const first = pathname.split('/').filter(Boolean)[0];
    return first && routing.locales.includes(first as Locale) ? first : null;
  }, [pathname]);
  const urlLocale = pathLocale ?? intlLocale;
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);

  useEffect(() => {
    if (pendingLocale != null && pathLocale === pendingLocale) {
      setPendingLocale(null);
    }
  }, [pathLocale, pendingLocale]);

  const locales = routing.locales.map((code) => localeMetadata[code]);

  function handleLocaleChange(nextLocale: string) {
    if (nextLocale === urlLocale) return;
    setPendingLocale(nextLocale);
    const newPathname = pathname.replace(
      new RegExp(`^/${urlLocale}(?=/|$)`),
      `/${nextLocale}`,
    );
    window.location.href = newPathname;
  }

  return (
    <LanguageSelect
      currentLocale={pendingLocale ?? urlLocale}
      locales={locales}
      onLocaleChange={handleLocaleChange}
      ariaLabel={tCommon('selectLanguage')}
    />
  );
}

function Screen({
  eyebrow,
  title,
  body,
  children,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="w-full">
      {eyebrow ? (
        <p className="text-1 tracking-[0.16em] text-neutral-11 uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1
        className={cn(
          'text-balance font-medium tracking-[-0.03em]',
          compact ? 'text-5 leading-tight' : 'text-7 leading-[1.05]',
          eyebrow && (compact ? 'mt-2' : 'mt-3'),
        )}
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h1>
      {body ? (
        <p className="mx-auto mt-4 max-w-[42ch] text-2 leading-relaxed text-neutral-11">
          {body}
        </p>
      ) : null}
      {children ? (
        <div
          className={cn(
            'grid w-full text-left',
            compact ? 'mt-5 gap-0' : 'mt-8 gap-5',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid w-full gap-1.5 text-left">
      <span className="text-1 text-neutral-11">{label}</span>
      {children}
      {hint ? <span className="text-1 text-neutral-10">{hint}</span> : null}
    </label>
  );
}
