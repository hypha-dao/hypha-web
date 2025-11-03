'use client';

import { usePathname } from 'next/navigation';
import { useProposalVoters } from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Button,
  Label,
  Separator,
} from '@hypha-platform/ui';
import Link from 'next/link';

export const VoterList = ({ documentSlug }: { documentSlug: string }) => {
  const { voters } = useProposalVoters(documentSlug);
  const maxVisibleVoters = 8;
  const pathname = usePathname();

  return voters && voters.length > 0 ? (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <Separator />
        <Label>Votes</Label>
        <div className="flex gap-2 overflow-x-auto items-center">
          {voters.slice(0, maxVisibleVoters).map((voter) => (
            <Tooltip key={voter.name}>
              <TooltipContent>
                {voter.name} voted {voter.vote}
              </TooltipContent>
              <TooltipTrigger>
                <PersonAvatar
                  key={voter.name}
                  avatarSrc={voter.avatarUrl}
                  userName={voter.name}
                />
              </TooltipTrigger>
            </Tooltip>
          ))}
          {voters.length > maxVisibleVoters && (
            <Link href={`${pathname}/voters`} scroll={false}>
              <Button variant="ghost" className="text-accent-11">
                and {voters.length - maxVisibleVoters} more
              </Button>
            </Link>
          )}
        </div>
      </div>
      <Separator />
    </div>
  ) : null;
};
