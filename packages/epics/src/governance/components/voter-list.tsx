'use client';

import { useProposalVoters } from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@hypha-platform/ui';

export const VoterList = ({ documentSlug }: { documentSlug: string }) => {
  const { voters } = useProposalVoters(documentSlug);
  return voters && voters.length > 0 ? (
    <div className="flex gap-2 overflow-x-auto">
      {voters.map((voter) => (
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
    </div>
  ) : null;
};
