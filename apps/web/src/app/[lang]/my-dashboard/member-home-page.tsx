'use client';

import {
  MemberHome,
  resolveMemberHomeGreetingName,
  resolveMemberHomePhase,
  SpaceAccessDenied,
  UserSpaceState,
  type MemberHomeRecord,
  type SignupOrientation,
} from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  buildMemberGuidance,
  useJwt,
  useMe,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, Container, Heading } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { HOME_REFRESH_EVENT } from '@hypha-platform/epics';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import useSWR from 'swr';

/** Past the server deadline, and before the ~40s function limit. */
const HOME_INTELLIGENCE_TIMEOUT_MS = 20_000;

/** Privy access tokens are JWTs; `sub` is the member id (`did:privy:…`). */
function readJwtSubject(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4;
    const padded = pad ? `${normalized}${'='.repeat(4 - pad)}` : normalized;
    const parsed = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof parsed.sub === 'string' && parsed.sub.trim()
      ? parsed.sub.trim()
      : null;
  } catch {
    return null;
  }
}

function sameMemberHome(
  left: MemberIntelligence | null | undefined,
  right: MemberIntelligence | null | undefined,
) {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function MemberHomePage({ lang }: { lang: Locale }) {
  const t = useTranslations('MemberHome');
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    user,
  } = useAuthentication();
  const { jwt, isLoadingJwt } = useJwt();
  const { person, isLoading: isPersonLoading, meError, revalidate } = useMe();
  const memberId = user?.id ?? null;
  const [isSavingOrientation, setIsSavingOrientation] = useState(false);
  const [orientationError, setOrientationError] = useState<string | null>(null);

  const jwtRef = useRef(jwt);
  const jwtOwnerRef = useRef<string | null>(null);
  const keepHomeKey = useRef(false);
  const jwtSubject = jwt ? readJwtSubject(jwt) : null;
  // SWR decides whether to fetch during render. The owner has to be visible
  // then, or the first request is skipped and nothing asks again.
  if (jwt && jwtSubject && memberId && jwtSubject === memberId) {
    jwtRef.current = jwt;
    jwtOwnerRef.current = jwtSubject;
    keepHomeKey.current = true;
  }
  useLayoutEffect(() => {
    if (!jwt || !jwtSubject || !memberId || jwtSubject !== memberId) return;
    jwtRef.current = jwt;
    jwtOwnerRef.current = jwtSubject;
    keepHomeKey.current = true;
  }, [jwt, jwtSubject, memberId]);
  const tokenOwner = jwtSubject ?? jwtOwnerRef.current;
  const homeKeyReady =
    Boolean(memberId) &&
    Boolean(tokenOwner) &&
    tokenOwner === memberId &&
    (Boolean(jwt) || keepHomeKey.current);
  const fetchHome = useCallback(
    async (scope: 'shell' | 'full') => {
      const token = jwtRef.current;
      if (!token || jwtOwnerRef.current !== memberId) {
        throw new Error('Access token not ready');
      }
      const url =
        scope === 'shell'
          ? '/api/v1/people/me/intelligence?scope=shell'
          : '/api/v1/people/me/intelligence';
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(HOME_INTELLIGENCE_TIMEOUT_MS),
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error('Failed to load home');
      }
      return (await response.json()) as MemberIntelligence;
    },
    [memberId],
  );
  const {
    data: shell,
    error: shellError,
    isLoading: isLoadingShell,
    mutate: reloadShell,
  } = useSWR<MemberIntelligence | null>(
    // The token string rotates. Keying on it dropped the cached home, unmounted
    // the assistant, and started a new turn a few seconds later. useJwt can
    // keep the previous member's token via keepPreviousData — only fetch when
    // that token's sub matches the current member.
    // Shell is the wallet pattern: spaces, proposals, and the chat, without
    // waiting for the chain roster and vote reads.
    homeKeyReady
      ? (['/api/v1/people/me/intelligence', memberId, 'shell'] as const)
      : null,
    () => fetchHome('shell'),
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
      keepPreviousData: false,
      isPaused: () => !jwtRef.current || jwtOwnerRef.current !== memberId,
      compare: sameMemberHome,
    },
  );
  const {
    data: full,
    error: fullError,
    isLoading: isLoadingFull,
    mutate,
  } = useSWR<MemberIntelligence | null>(
    homeKeyReady && shell
      ? (['/api/v1/people/me/intelligence', memberId, 'full'] as const)
      : null,
    () => fetchHome('full'),
    {
      refreshInterval: 10_000,
      revalidateOnFocus: true,
      keepPreviousData: false,
      isPaused: () => !jwtRef.current || jwtOwnerRef.current !== memberId,
      compare: sameMemberHome,
    },
  );
  const data = full === undefined ? shell : full;
  const error = data ? null : shellError ?? fullError;
  const isLoadingHome = !data && (isLoadingShell || isLoadingFull);
  useEffect(() => {
    if (!homeKeyReady || shell !== undefined || shellError || isLoadingShell) {
      return;
    }
    void reloadShell();
  }, [homeKeyReady, isLoadingShell, reloadShell, shell, shellError]);

  useEffect(() => {
    let timer = 0;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void mutate();
      }, 300);
    };
    window.addEventListener(HOME_REFRESH_EVENT, refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(HOME_REFRESH_EVENT, refresh);
    };
  }, [mutate]);

  const chooseOrientation = useCallback(
    async (primaryOrientation: SignupOrientation) => {
      if (!jwt) return;
      setIsSavingOrientation(true);
      setOrientationError(null);
      try {
        const response = await fetch('/api/v1/people/me/orientation', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ primaryOrientation }),
        });
        if (!response.ok) {
          setOrientationError(t('orientationSaveError'));
          return;
        }
        let nextOrientation = primaryOrientation;
        try {
          const saved = (await response.json()) as {
            primaryOrientation?: string | null;
          };
          if (
            saved.primaryOrientation === 'member' ||
            saved.primaryOrientation === 'builder' ||
            saved.primaryOrientation === 'investor'
          ) {
            nextOrientation = saved.primaryOrientation;
          }
        } catch {
          // The choice is already stored. A missing body should not block the badge.
        }
        if (person?.id) {
          await revalidate({
            ...person,
            primaryOrientation: nextOrientation,
          });
        }
        await mutate(
          (current) => {
            if (!current) return current;
            const nextPerson = {
              ...current.person,
              primaryOrientation: nextOrientation,
            };
            return {
              ...current,
              person: nextPerson,
              guidance: {
                narrative: buildMemberGuidance({
                  firstName:
                    nextPerson.name?.trim() ||
                    nextPerson.nickname?.trim() ||
                    'there',
                  orientation: nextOrientation,
                  attention: current.attention[0] ?? null,
                  spaceCount: current.counts.spaces,
                }),
              },
            };
          },
          { revalidate: false },
        );
      } catch {
        setOrientationError(t('orientationSaveError'));
      } finally {
        setIsSavingOrientation(false);
      }
    },
    [jwt, mutate, person, revalidate, t],
  );

  const personRecord: MemberHomeRecord =
    person === null ? 'none' : person ? 'present' : 'missing';
  const homeRecord: MemberHomeRecord =
    data === null ? 'none' : data ? 'present' : 'missing';
  // After a profile has loaded this visit, a brief /me 404 must not reopen
  // the welcome flow (common after idle JWT refresh or a notification click).
  const hadPersonRef = useRef(false);
  if (person) hadPersonRef.current = true;
  if (!isAuthenticated) hadPersonRef.current = false;
  // Privy `authenticated` (what the header uses) can be true before a Bearer
  // token exists. Only a GET /me 404 is "no profile". A 500 stays signed in.
  const resolvedPhase = resolveMemberHomePhase({
    authLoading: isAuthLoading,
    jwtLoading: isLoadingJwt,
    authenticated: isAuthenticated,
    personLoading: isPersonLoading,
    person: personRecord,
    meError: Boolean(meError),
    homeLoading: isLoadingHome,
    home: homeRecord,
    homeError: Boolean(error),
  });
  const phase =
    resolvedPhase === 'signup' && hadPersonRef.current
      ? 'loading'
      : resolvedPhase;

  useEffect(() => {
    if (phase !== 'signup') return;
    router.replace(`/${lang}/profile/signup`);
  }, [phase, lang, router]);

  const personIsCurrentMember =
    Boolean(memberId) && tokenOwner === memberId && person?.sub === memberId;
  const greetingName = resolveMemberHomeGreetingName({
    personName: person?.name,
    personNickname: person?.nickname,
    personIsCurrentMember,
  });

  if (phase === 'signup') {
    return (
      <p className="px-5 py-16 text-center text-2 text-neutral-11">
        {t('loading')}
      </p>
    );
  }

  if (phase === 'signed-out') {
    return (
      <div className="w-full min-w-0 overflow-x-clip">
        <Container className="flex min-w-0 flex-col gap-4 py-3 sm:py-4 lg:py-5 xl:gap-9 xl:pt-3 xl:pb-9">
          <header className="xl:hidden">
            <p className="mb-2 text-1 font-bold uppercase text-foreground">
              {t('pageTitleLineOne')}
            </p>
            <h1
              className="text-7 leading-tight sm:text-8"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('pageTitleLineTwo')}
            </h1>
          </header>
          <Heading
            size="9"
            color="secondary"
            weight="medium"
            align="center"
            className="hidden flex-col xl:flex"
          >
            <span>{t('pageTitleLineOne')}</span>
            <span>{t('pageTitleLineTwo')}</span>
          </Heading>
          <div className="flex min-h-[50vh] w-full items-center justify-center px-5 py-16">
            <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />
          </div>
        </Container>
      </div>
    );
  }

  if (phase === 'profile-unavailable') {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <p className="text-2 text-neutral-11">{t('profileUnavailable')}</p>
        <Button
          className="mt-4"
          type="button"
          onClick={() => {
            void revalidate();
            void mutate();
          }}
        >
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (phase === 'home-unavailable') {
    return (
      <MemberHome
        lang={lang}
        isLoading={false}
        greetingName={greetingName}
        unavailable={
          <>
            <p className="text-1 text-neutral-11">{t('homeUnavailable')}</p>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              size="sm"
              onClick={() => {
                void revalidate();
                void mutate();
              }}
            >
              {t('retry')}
            </Button>
          </>
        }
        isSavingOrientation={isSavingOrientation}
        orientationError={orientationError}
        onChooseOrientation={(orientation) => {
          void chooseOrientation(orientation);
        }}
      />
    );
  }

  // Intelligence can hang until a 504. Keep the person shell (greeting)
  // instead of a hard error or a 40s skeleton while the request is in flight.
  if (!data) {
    return (
      <MemberHome
        lang={lang}
        isLoading={isLoadingHome}
        greetingName={greetingName}
        isSavingOrientation={isSavingOrientation}
        orientationError={orientationError}
        onChooseOrientation={(orientation) => {
          void chooseOrientation(orientation);
        }}
      />
    );
  }

  return (
    <MemberHome
      lang={lang}
      intelligence={
        fullError && data.partial ? { ...data, partial: false } : data
      }
      isSavingOrientation={isSavingOrientation}
      orientationError={orientationError}
      onChooseOrientation={(orientation) => {
        void chooseOrientation(orientation);
      }}
    />
  );
}
