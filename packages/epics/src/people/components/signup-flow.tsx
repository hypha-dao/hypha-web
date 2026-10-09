'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { FieldError } from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Input,
  Logo,
  UploadAvatar,
  UploadLeadImage,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Links } from '../../common';

export type SignupOrientation = 'member' | 'builder' | 'investor';

export type SignupFlowValues = {
  name: string;
  surname: string;
  nickname: string;
  description: string;
  email?: string;
  address: string;
  links: string[];
  location?: string;
  avatarUrl?: File;
  leadImageUrl?: File;
  primaryOrientation: SignupOrientation;
};

type SignupFlowProps = {
  email?: string;
  walletAddress?: string;
  isCreating?: boolean;
  error?: string | null;
  onComplete: (values: SignupFlowValues) => Promise<void>;
};

const STEPS = [
  'welcome',
  'name',
  'presence',
  'likeness',
  'place',
  'orientation',
  'arrival',
] as const;
type Step = (typeof STEPS)[number];

const ORIENTATIONS: SignupOrientation[] = ['member', 'builder', 'investor'];

/** Ink on paper. Space accent remaps `bg-accent-9` to a hue; these actions stay achromatic. */
const primaryActionClassName =
  '!bg-foreground !text-background hover:!bg-foreground hover:!text-background';

export function SignupFlow({
  email,
  walletAddress,
  isCreating,
  error,
  onComplete,
}: SignupFlowProps) {
  const t = useTranslations('WelcomeFlow');
  const tProfile = useTranslations('Profile');
  const tCommon = useTranslations('Common');
  const tSpaces = useTranslations('Spaces');
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<File | null>(null);
  const [leadImageUrl, setLeadImageUrl] = useState<File | null>(null);
  const [location, setLocation] = useState('');
  const [profileEmail, setProfileEmail] = useState(email?.trim() ?? '');
  const [links, setLinks] = useState<string[]>([]);
  const [linkErrors, setLinkErrors] = useState<
    Partial<Record<number, FieldError>> | undefined
  >(undefined);
  const [orientation, setOrientation] = useState<SignupOrientation | null>(
    null,
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    setProfileEmail((current) => (current.trim() ? current : email.trim()));
  }, [email]);

  const index = STEPS.indexOf(step);
  const walletReady = Boolean(walletAddress);

  const validatePlace = () => {
    const loc = location.trim();
    if (loc.length > 100) {
      setFieldError(tProfile('editForm.errors.locationMaxLength'));
      return false;
    }
    const mail = profileEmail.trim();
    if (mail.length > 100) {
      setFieldError(tProfile('editForm.errors.emailMaxLength'));
      return false;
    }
    if (mail && !z.string().email().safeParse(mail).success) {
      setFieldError(tProfile('editForm.errors.emailInvalid'));
      return false;
    }
    const nextLinkErrors: Partial<Record<number, FieldError>> = {};
    links.forEach((link, linkIndex) => {
      const value = link.trim();
      if (!value) return;
      if (!z.string().url().safeParse(value).success) {
        nextLinkErrors[linkIndex] = {
          type: 'validate',
          message: tProfile('editForm.errors.urlInvalid'),
        };
      }
    });
    if (Object.keys(nextLinkErrors).length > 0) {
      setLinkErrors(nextLinkErrors);
      setFieldError(tProfile('editForm.errors.urlInvalid'));
      return false;
    }
    setLinkErrors(undefined);
    return true;
  };

  const goNext = () => {
    setFieldError(null);
    if (step === 'name') {
      if (!name.trim() || !surname.trim()) {
        setFieldError(t('name.body'));
        return;
      }
    }
    if (step === 'presence') {
      const nick = nickname.trim();
      if (!nick || nick.length > 12) {
        setFieldError(t('presence.nicknameHint'));
        return;
      }
    }
    if (step === 'place' && !validatePlace()) return;
    if (step === 'orientation' && !orientation) {
      setFieldError(t('orientation.body'));
      return;
    }
    const next = STEPS[index + 1];
    if (next) setStep(next);
  };

  const finish = async () => {
    if (!orientation || !walletAddress) return;
    if (!validatePlace()) {
      setStep('place');
      return;
    }
    setFieldError(null);
    try {
      const trimmedLocation = location.trim();
      const trimmedEmail = profileEmail.trim();
      await onComplete({
        name: name.trim(),
        surname: surname.trim(),
        nickname: nickname.trim(),
        description: description.trim(),
        email: trimmedEmail || undefined,
        address: walletAddress,
        links: links.map((link) => link.trim()).filter(Boolean),
        location: trimmedLocation || undefined,
        avatarUrl: avatarUrl ?? undefined,
        leadImageUrl: leadImageUrl ?? undefined,
        primaryOrientation: orientation,
      });
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-[center_right] opacity-50 dark:opacity-30"
        style={{ backgroundImage: 'url(/brand/mycelium.jpg)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/92 to-background/35"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <Logo width={96} />
        <p className="mt-6 w-full text-1 text-neutral-11">
          {t('step', { current: index + 1, total: STEPS.length })}
        </p>
        <div className="mt-3 flex w-full justify-center gap-1" aria-hidden>
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

        <div className="mt-10 w-full">
          {step === 'welcome' ? (
            <Screen
              eyebrow={t('welcome.eyebrow')}
              title={t('welcome.title')}
              body={t('welcome.body')}
            />
          ) : null}

          {step === 'name' ? (
            <Screen
              eyebrow={t('name.eyebrow')}
              title={t('name.title')}
              body={t('name.body')}
            >
              <Field label={t('name.firstName')}>
                <Input
                  value={name}
                  autoComplete="given-name"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label={t('name.lastName')}>
                <Input
                  value={surname}
                  autoComplete="family-name"
                  onChange={(event) => setSurname(event.target.value)}
                />
              </Field>
            </Screen>
          ) : null}

          {step === 'presence' ? (
            <Screen
              eyebrow={t('presence.eyebrow')}
              title={t('presence.title')}
              body={t('presence.body')}
            >
              <Field
                label={t('presence.nickname')}
                hint={t('presence.nicknameHint')}
              >
                <Input
                  value={nickname}
                  maxLength={12}
                  autoComplete="username"
                  onChange={(event) => setNickname(event.target.value)}
                />
              </Field>
              <Field label={t('presence.purpose')}>
                <Input
                  value={description}
                  maxLength={300}
                  placeholder={t('presence.purposePlaceholder')}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
            </Screen>
          ) : null}

          {step === 'likeness' ? (
            <Screen
              eyebrow={t('likeness.eyebrow')}
              title={t('likeness.title')}
              body={t('likeness.body')}
            >
              <div className="grid w-fit gap-2">
                <span className="text-1 text-neutral-11">
                  {t('likeness.icon')}
                </span>
                <UploadAvatar
                  onChange={setAvatarUrl}
                  className="!h-24 !min-w-24 !w-24"
                />
                <span className="text-1 text-neutral-10">
                  {t('likeness.iconHint')}
                </span>
              </div>
              <Field
                composite
                label={t('likeness.banner')}
                hint={t('likeness.bannerHint')}
              >
                <UploadLeadImage
                  onChange={setLeadImageUrl}
                  enableImageResizer={true}
                  uploadText={tCommon.rich(
                    'uploadLeadImage.genericUploadFallback',
                    {
                      accent: (chunks) => (
                        <span className="text-foreground">{chunks}</span>
                      ),
                    },
                  )}
                  cropDialogLabels={{
                    title: tCommon('uploadLeadImage.cropTitle'),
                    description: tCommon('uploadLeadImage.cropDescription'),
                    cancel: tCommon('uploadLeadImage.cancel'),
                    confirm: tCommon('uploadLeadImage.confirm'),
                  }}
                  messages={{
                    dropHere: tCommon('uploadLeadImage.dropHere'),
                    fileTooLarge: tCommon('uploadLeadImage.fileTooLarge'),
                    uploadFailed: tCommon('uploadLeadImage.uploadFailed'),
                  }}
                />
              </Field>
            </Screen>
          ) : null}

          {step === 'place' ? (
            <Screen
              eyebrow={t('place.eyebrow')}
              title={t('place.title')}
              body={t('place.body')}
            >
              <Field label={tProfile('editForm.labels.location')}>
                <Input
                  value={location}
                  maxLength={100}
                  placeholder={tProfile('editForm.placeholders.location')}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </Field>
              <Field label={tProfile('editForm.labels.email')}>
                <Input
                  value={profileEmail}
                  maxLength={100}
                  type="email"
                  autoComplete="email"
                  placeholder={tProfile('editForm.placeholders.email')}
                  onChange={(event) => setProfileEmail(event.target.value)}
                />
              </Field>
              <Field composite label={t('place.links')}>
                <Links
                  links={links}
                  errors={linkErrors}
                  placeholder={tSpaces('addYourUrl')}
                  onChange={(next) => {
                    setLinks(next);
                    setLinkErrors(undefined);
                    setFieldError(null);
                  }}
                />
              </Field>
            </Screen>
          ) : null}

          {step === 'orientation' ? (
            <Screen
              eyebrow={t('orientation.eyebrow')}
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
                      <OrientationMark orientation={option} />
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

          {step === 'arrival' && orientation ? (
            <Screen
              eyebrow={t('arrival.eyebrow')}
              title={t('arrival.title', {
                name: name.trim() || nickname.trim(),
              })}
              body={t(`arrival.${orientation}`)}
            />
          ) : null}
        </div>

        {email ? (
          <p className="mt-8 w-full text-1 text-neutral-11">
            {t('signedInAs', { email })}
          </p>
        ) : null}
        {!walletReady ? (
          <p className="mt-3 w-full text-1 text-neutral-11">
            {t('walletWait')}
          </p>
        ) : null}
        {fieldError || error ? (
          <p className="mt-4 w-full text-2 text-error-11" role="alert">
            {fieldError || error}
          </p>
        ) : null}

        <div className="mt-8 flex w-full items-center justify-center gap-3">
          {index > 0 ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
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
              className={primaryActionClassName}
              disabled={!walletReady}
              onClick={goNext}
            >
              {walletReady ? t('begin') : t('walletWait')}
            </Button>
          ) : null}
          {step !== 'welcome' && step !== 'arrival' ? (
            <Button
              type="button"
              className={primaryActionClassName}
              onClick={goNext}
            >
              {step === 'orientation' ? t('thisIsMe') : t('continue')}
            </Button>
          ) : null}
          {step === 'arrival' ? (
            <Button
              type="button"
              className={primaryActionClassName}
              disabled={isCreating || !walletReady || !orientation}
              onClick={() => {
                void finish();
              }}
            >
              {isCreating ? t('saving') : t('enterHome')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Screen({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="w-full">
      <p className="text-1 tracking-[0.16em] text-neutral-11 uppercase">
        {eyebrow}
      </p>
      <h1
        className="mt-3 text-balance text-7 leading-[1.05] font-medium tracking-[-0.03em]"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-[42ch] text-2 leading-relaxed text-neutral-11">
        {body}
      </p>
      {children ? (
        <div className="mt-8 grid w-full gap-5 text-left">{children}</div>
      ) : null}
    </div>
  );
}

function OrientationMark({ orientation }: { orientation: SignupOrientation }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className="block size-8 text-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="miter"
    >
      {orientation === 'member' ? (
        <>
          <circle cx="16" cy="16" r="10" />
          <circle cx="16" cy="16" r="3.75" />
        </>
      ) : null}
      {orientation === 'builder' ? (
        <>
          <rect x="6" y="12" width="14" height="14" />
          <path d="M12 12V6h14v14h-6" />
        </>
      ) : null}
      {orientation === 'investor' ? <path d="M16 6 26 16 16 26 6 16Z" /> : null}
    </svg>
  );
}

function Field({
  label,
  hint,
  children,
  composite = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  composite?: boolean;
}) {
  const Tag = composite ? 'div' : 'label';
  return (
    <Tag className="grid w-full gap-2 text-left">
      <span className="text-1 text-neutral-11">{label}</span>
      {children}
      {hint ? <span className="text-1 text-neutral-10">{hint}</span> : null}
    </Tag>
  );
}
