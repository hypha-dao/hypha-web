'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
} from '@hypha-platform/ui';
import type { NetworkPerson } from '../network-pulse';

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'P';
}

export function NetworkPeopleStrip({
  lang,
  people,
}: {
  lang: Locale;
  people: NetworkPerson[];
}) {
  const t = useTranslations('Journey');
  if (people.length === 0) return null;

  return (
    <Card className="craft-card">
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
            {t('connectTitle')}
          </h2>
          <p className="mt-1 text-2 text-muted-foreground">
            {t('connectLead')}
          </p>
        </div>
        <ul className="flex flex-wrap gap-3">
          {people.map((person) => (
            <li key={person.slug}>
              <Link
                href={`/${lang}/profile/${person.slug}`}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-background-3/50"
              >
                <Avatar className="size-8 rounded-chrome">
                  <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="rounded-chrome text-1">
                    {initials(person.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[12ch] truncate text-2">
                  {person.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
