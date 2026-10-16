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

export function RoleGlyph({
  role,
  size = 14,
}: {
  role: PersonRole;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className="block shrink-0"
      style={{ width: size, height: size }}
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

/**
 * Role marks:
 * - Default (beside a member name): bare icon, no box — label on title/aria.
 * - Stacked (orientation control): larger icon with the role label under it.
 */
export function PersonBadges({
  items,
  stacked = false,
}: {
  items: PersonBadgeItem[];
  stacked?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <span
      className={
        stacked
          ? 'inline-flex max-w-full flex-col items-center gap-1.5'
          : 'inline-flex max-w-full flex-wrap items-center gap-1'
      }
    >
      {items.map((item) =>
        item.role ? (
          stacked ? (
            <span
              key={item.id}
              className="inline-flex flex-col items-center gap-1 text-1 text-foreground"
            >
              <RoleGlyph role={item.role} size={36} />
              <span className="text-center">{item.label}</span>
            </span>
          ) : (
            <span
              key={item.id}
              title={item.label}
              aria-label={item.label}
              className="inline-flex shrink-0 text-foreground"
            >
              <RoleGlyph role={item.role} size={14} />
            </span>
          )
        ) : (
          <span
            key={item.id}
            className="inline-flex max-w-full items-center border border-border bg-neutral-3 px-2 py-0.5 text-1 text-foreground"
          >
            <span className="truncate">{item.label}</span>
          </span>
        ),
      )}
    </span>
  );
}

export function PersonRoleBadge({
  role,
  stacked = false,
}: {
  role: PersonRole;
  stacked?: boolean;
}) {
  const t = useTranslations('WelcomeFlow');
  return (
    <PersonBadges
      stacked={stacked}
      items={[roleBadge(role, t(`orientation.${role}.title`))]}
    />
  );
}
