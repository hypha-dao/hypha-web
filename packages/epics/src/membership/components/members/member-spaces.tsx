import { Skeleton, Image } from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core';

export type MemberSpacesProps = {
  spaces?: Space[];
  isLoading?: boolean;
  profileView?: boolean;
};

export const MemberSpaces = ({
  spaces,
  isLoading,
  profileView = false,
}: MemberSpacesProps) => {
  return (
    <div className="flex justify-between items-center">
      {isLoading ? (
        <Skeleton
          width="60px"
          height="26px"
          loading={isLoading}
          className="rounded-lg"
        />
      ) : !profileView ? (
        <div className="text-4 mr-4">Spaces</div>
      ) : null}
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
          {spaces?.map((space, index) => (
            <div key={index}>
              <Image
                // TODO: space doesn't have id field yet
                className="rounded-full h-fit"
                width={profileView ? 64 : 40}
                height={profileView ? 64 : 40}
                src={space.logoUrl ?? ''}
                alt={space.title ?? ''}
              />
              {profileView ? (
                <div className="text-1 text-ellipsis overflow-hidden text-nowrap max-w-[64px] mt-2">
                  {space.title}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
