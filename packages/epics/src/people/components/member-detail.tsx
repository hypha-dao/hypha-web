import { MemberHead } from './member-head';
import { Skeleton, Button, Separator } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import Link from 'next/link';
import { MemberSpaces } from './member-spaces';
import { Space } from '@hypha-platform/core/client';
import { UseDocuments } from '../../governance';
import { AgreementsSection } from '../../agreements';

type MemberType = {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  nickname?: string;
  status?: string;
  about?: string;
};

export type MemberDetailProps = {
  closeUrl: string;
  member: MemberType;
  isLoading: boolean;
  basePath: string;
  spaces: Space[];
  useDocuments: UseDocuments;
};

export const MemberDetail = ({
  isLoading,
  closeUrl,
  member,
  basePath,
  spaces,
  useDocuments,
}: MemberDetailProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <MemberHead {...member} isLoading={isLoading} />
        <Link href={closeUrl} scroll={false}>
          <Button
            variant="ghost"
            colorVariant="neutral"
            className="flex items-center"
          >
            Close
            <RxCross1 className="ml-2" />
          </Button>
        </Link>
      </div>
      <Separator />
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <div className="text-2 text-neutral-11">{member.about}</div>
      </Skeleton>
      <Separator />
      <MemberSpaces spaces={spaces} />
      <Separator />
      {/*<AgreementsSection basePath={basePath} useDocuments={useDocuments} />*/}
    </div>
  );
};
