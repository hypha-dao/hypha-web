'use client';

import { useTranslations } from 'next-intl';
import { stringToHue, getInitials } from './utils';

export type Member = {
  id: string;
  name: string;
  isOnline?: boolean;
};

type HumanChatPanelMembersProps = {
  members?: Member[];
};

export function HumanChatPanelMembers({ members }: HumanChatPanelMembersProps) {
  const t = useTranslations('HumanChatPanel');
  const displayMembers = members ?? [];

  const onlineCount = displayMembers.filter((m) => m.isOnline).length;

  return (
    <div className="flex flex-col gap-1 px-3 py-3">
      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
        {t('membersCount', {
          count: displayMembers.length,
          online: onlineCount,
        })}
      </div>
      {displayMembers.length === 0 && (
        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
          {t('noMembers')}
        </div>
      )}
      {displayMembers.map((member) => {
        const hue = stringToHue(member.name);
        const initials = getInitials(member.name);

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
          >
            {/* Avatar with online indicator */}
            <div className="relative shrink-0">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-semibold"
                style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
              >
                {initials}
              </div>
              {member.isOnline !== undefined && (
                <div
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background-2 ${
                    member.isOnline ? 'bg-green-500' : 'bg-muted-foreground/40'
                  }`}
                />
              )}
            </div>

            {/* Name */}
            <span className="text-sm text-foreground truncate">
              {member.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
