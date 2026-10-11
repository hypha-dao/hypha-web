'use client';

import { useTranslations } from 'next-intl';

/** A role someone chose. More badge kinds can sit beside it later. */
export type PersonRole = 'member' | 'builder' | 'investor';

export type PersonBadgeItem = {
  id: string;
  label: string;
  role?: PersonRole;
};

export function isPersonRole(
  value: string | null | undefined,
): value is PersonRole {
  return value === 'member' || value === 'builder' || value === 'investor';
}

export function roleBadge(role: PersonRole, label: string): PersonBadgeItem {
  return { id: `role:${role}`, label, role };
}

export function RoleGlyph({ role }: { role: PersonRole }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className="block shrink-0"
      style={{ width: 14, height: 14 }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="miter"
    >
      {role === 'member' ? (
        <>
          <circle cx="16" cy="16" r="10" />
          <circle cx="16" cy="16" r="3.75" />
        </>
      ) : null}
      {role === 'builder' ? (
        <>
          <rect x="6" y="12" width="14" height="14" />
          <path d="M12 12V6h14v14h-6" />
        </>
      ) : null}
      {role === 'investor' ? <path d="M16 6 26 16 16 26 6 16Z" /> : null}
    </svg>
  );
}

/** One or more badges. A role is the first kind; later badges use the same chip. */
export function PersonBadges({ items }: { items: PersonBadgeItem[] }) {
  if (items.length === 0) return null;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex max-w-full items-center gap-1.5 border border-foreground bg-background px-2 py-0.5 text-1 text-foreground"
        >
          {item.role ? <RoleGlyph role={item.role} /> : null}
          <span className="truncate">{item.label}</span>
        </span>
      ))}
    </span>
  );
}

export function PersonRoleBadge({ role }: { role: PersonRole }) {
  const t = useTranslations('WelcomeFlow');
  return (
    <PersonBadges items={[roleBadge(role, t(`orientation.${role}.title`))]} />
  );
}
