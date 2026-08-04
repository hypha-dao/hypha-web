'use client';

import { LogOut, Menu, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { formatNumber, useCampaign } from '../_lib/campaign-store';
import { RsButton } from './ui';

const NAV = [
  { href: '/#projects', label: 'Projects' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#tally', label: 'Live tally' },
  { href: 'https://www.regen.sydney', label: 'regen.sydney', external: true },
];

export function RsHeader({ onSignIn }: { onSignIn: () => void }) {
  const { user, balance, signOut, hydrated } = useCampaign();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--rs-line)] bg-[var(--rs-cream)]/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-5">
        <Link href="/" className="rs-focus flex shrink-0 items-center rounded">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/rs-logo.webp"
            alt="Regen Sydney"
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noreferrer' : undefined}
              className="rs-eyebrow rs-focus rounded text-[var(--rs-ink-soft)] transition-colors hover:text-[var(--rs-ink)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {hydrated && user ? (
            <>
              <div className="hidden items-center gap-3 sm:flex">
                <div className="rs-tabular rounded-full bg-[var(--rs-aqua)] px-4 py-2 text-right">
                  <span className="rs-eyebrow block leading-none text-[var(--rs-teal)]">
                    Your RSUT
                  </span>
                  <span className="rs-heading text-base leading-tight">
                    {formatNumber(balance)}
                  </span>
                </div>
                {user.isAdmin ? (
                  <Link href="/admin">
                    <RsButton variant="ghost" size="sm">
                      <Settings size={14} /> Admin
                    </RsButton>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={signOut}
                  aria-label="Sign out"
                  className="rs-focus flex size-10 items-center justify-center rounded-full border border-[var(--rs-line)] text-[var(--rs-ink-soft)] transition-colors hover:border-[var(--rs-ink)] hover:text-[var(--rs-ink)]"
                >
                  <LogOut size={16} />
                </button>
              </div>
              <div className="rs-tabular rounded-full bg-[var(--rs-aqua)] px-3 py-1.5 sm:hidden">
                <span className="rs-heading text-sm">
                  {formatNumber(balance)}
                </span>
              </div>
            </>
          ) : (
            <RsButton
              onClick={onSignIn}
              size="sm"
              className="hidden sm:inline-flex"
            >
              Sign in
            </RsButton>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="rs-focus flex size-10 items-center justify-center rounded-full border border-[var(--rs-line)] lg:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-[var(--rs-line)] bg-[var(--rs-cream)] px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noreferrer' : undefined}
                onClick={() => setMenuOpen(false)}
                className="rs-eyebrow rs-focus rounded text-[var(--rs-ink-soft)]"
              >
                {item.label}
              </a>
            ))}
            {user?.isAdmin ? (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="rs-eyebrow rs-focus rounded text-[var(--rs-ink-soft)]"
              >
                Admin
              </Link>
            ) : null}
          </nav>
          <div className="mt-5">
            {user ? (
              <RsButton variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </RsButton>
            ) : (
              <RsButton
                size="sm"
                onClick={() => {
                  setMenuOpen(false);
                  onSignIn();
                }}
              >
                Sign in
              </RsButton>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
