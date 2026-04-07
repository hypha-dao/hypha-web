'use client';

import { useProposalVoters } from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Button, Badge, Separator } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

interface FullVoterListProps {
  documentSlug: string;
}

export const FullVoterList = ({ documentSlug }: FullVoterListProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const { voters } = useProposalVoters(documentSlug);

  return (
    <div className="flex flex-col gap-4">
      {voters?.map((voter) => (
        <div key={voter.name}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PersonAvatar
                avatarSrc={voter.avatarUrl}
                userName={voter.name}
                className="w-7 h-7"
              />
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Badge size={0} variant="solid" colorVariant="accent">
                    {tProposalDetails('badges.member')}
                  </Badge>
                  <Badge size={0} variant="outline" colorVariant="success">
                    {tProposalDetails('badges.active')}
                  </Badge>
                </div>
                <span className="text-4 text-white">{voter.name}</span>
              </div>
            </div>
            <Button
              variant="default"
              colorVariant={voter.vote === 'yes' ? 'accent' : 'error'}
              disabled
            >
              {tProposalDetails('voters.voted', {
                vote:
                  voter.vote === 'yes'
                    ? tProposalDetails('voting.voteValueYes')
                    : tProposalDetails('voting.voteValueNo'),
              })}
            </Button>
          </div>
          <Separator />
        </div>
      ))}
    </div>
  );
};
