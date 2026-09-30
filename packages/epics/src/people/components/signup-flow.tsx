'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export type SignupOrientation = 'member' | 'builder' | 'investor';

export type SignupFlowValues = {
  name: string;
  surname: string;
  nickname: string;
  description: string;
  email?: string;
  address: string;
  links: string[];
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
  'orientation',
  'arrival',
] as const;
type Step = (typeof STEPS)[number];

const ORIENTATIONS: SignupOrientation[] = ['member', 'builder', 'investor'];

export function SignupFlow({
  email,
  walletAddress,
  isCreating,
  error,
  onComplete,
}: SignupFlowProps) {
  const t = useTranslations('WelcomeFlow');
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [orientation, setOrientation] = useState<SignupOrientation | null>(
    null,
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  const index = STEPS.indexOf(step);
  const walletReady = Boolean(walletAddress);

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
    if (step === 'orientation' && !orientation) {
      setFieldError(t('orientation.body'));
      return;
    }
    const next = STEPS[index + 1];
    if (next) setStep(next);
  };

  const finish = async () => {
    if (!orientation || !walletAddress) return;
    setFieldError(null);
    await onComplete({
      name: name.trim(),
      surname: surname.trim(),
      nickname: nickname.trim(),
      description: description.trim(),
      email: email?.trim() || undefined,
      address: walletAddress,
      links: [],
      primaryOrientation: orientation,
    });
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
        <p
          className="text-2 tracking-[0.18em] text-neutral-11 uppercase"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          Hypha
        </p>
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
                          ? 'border-foreground bg-accent-3'
                          : 'border-border bg-background/80 hover:bg-accent-2',
                      )}
                    >
                      <span
                        className="block text-3"
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
            <Button type="button" disabled={!walletReady} onClick={goNext}>
              {walletReady ? t('begin') : t('walletWait')}
            </Button>
          ) : null}
          {step !== 'welcome' && step !== 'arrival' ? (
            <Button type="button" onClick={goNext}>
              {step === 'orientation' ? t('thisIsMe') : t('continue')}
            </Button>
          ) : null}
          {step === 'arrival' ? (
            <Button
              type="button"
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
    <label className="grid w-full gap-2 text-left">
      <span className="text-1 text-neutral-11">{label}</span>
      {children}
      {hint ? <span className="text-1 text-neutral-10">{hint}</span> : null}
    </label>
  );
}
