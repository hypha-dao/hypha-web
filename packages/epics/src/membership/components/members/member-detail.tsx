import { MemberHead } from './member-head';
import { Skeleton, Button, Separator, FilterMenu } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { Image } from '@hypha-platform/ui';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import { AgreementItem } from '@hypha-platform/graphql/rsc';
import { useMemberDetails } from '../../hooks/use-member-details';
import Link from 'next/link';
import { AgreementsList } from '../../../agreements/components/agreements-list';

type SpaceType = {
  name?: string;
  logo?: string;
};

type MemberType = {
  avatar?: string;
  name?: string;
  surname?: string;
  nickname?: string;
  commitment?: number;
  status?: string;
  about?: string;
  spaces?: SpaceType[];
  agreements?: AgreementItem[];
};

export type MemberDetailProps = {
  closeUrl: string;
  member: MemberType;
  agreements: AgreementItem[];
  isLoading: boolean;
};

export const MemberDetail = ({
  isLoading,
  closeUrl,
  member,
}: MemberDetailProps) => {
  const {
    loadMore,
    pagination,
    paginatedAgreements,
    activeFilter,
    setActiveFilter,
  } = useMemberDetails(member.agreements ?? []);

  const filterSettings = {
    value: activeFilter,
    options: [
      { label: 'All', value: 'all' },
      { label: 'Most recent', value: 'most-recent' },
    ],
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <MemberHead {...member} isLoading={isLoading} />
        <Link href={closeUrl}>
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
      <div className="flex justify-between items-center">
        {isLoading ? (
          <Skeleton
            width="60px"
            height="26px"
            loading={isLoading}
            className="rounded-lg"
          />
        ) : (
          <div className="text-4 mr-4">Spaces</div>
        )}

        {isLoading ? (
          <div className="flex flex-row gap-3 overflow-x-auto">
            <Skeleton
              width="40px"
              height="40px"
              loading={isLoading}
              className="rounded-full"
            />
            <Skeleton
              width="40px"
              height="40px"
              loading={isLoading}
              className="rounded-full"
            />
            <Skeleton
              width="40px"
              height="40px"
              loading={isLoading}
              className="rounded-full"
            />
          </div>
        ) : (
          <div className="flex flex-row gap-3 overflow-x-auto">
            {member.spaces?.map((space) => (
              <Image
                width={40}
                height={40}
                src={space.logo ?? ''}
                alt={space.name ?? ''}
              />
            ))}
          </div>
        )}
      </div>
      <Separator />
      <div className="flex justify-between">
        {isLoading ? (
          <Skeleton
            width="60px"
            height="26px"
            loading={isLoading}
            className="rounded-lg"
          />
        ) : (
          <div className="text-4 font-medium">
            Agreements | {member.agreements?.length}
          </div>
        )}
        <FilterMenu
          value={filterSettings.value}
          onChange={setActiveFilter}
          options={filterSettings.options}
        />
      </div>
      <AgreementsList
        page={pagination.totalPages}
        activeFilter={activeFilter}
        agreementsProp={paginatedAgreements}
        basePath=""
        withoutAvatar={true}
      />
      <SectionLoadMore
        onClick={loadMore}
        disabled={!pagination.hasNextPage}
        isLoading={isLoading}
      >
        {!pagination.hasNextPage ? 'No more members' : 'Load more members'}
      </SectionLoadMore>
    </div>
  );
};
