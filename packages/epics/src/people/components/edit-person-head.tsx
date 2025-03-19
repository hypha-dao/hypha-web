import { Skeleton } from '@hypha-platform/ui';
import { MemberType } from '@hypha-platform/graphql/rsc';
import { Image } from '@hypha-platform/ui';
import { Input } from '@hypha-platform/ui';

export type EditPersonHeadProps = {
  isLoading?: boolean;
  nickname?: string;
};

export const EditPersonHead = ({
  name,
  surname,
  avatar,
  isLoading,
  nickname,
  onNameChange,
  onSurnameChange,
  onNicknameChange,
}: EditPersonHeadProps &
  MemberType & {
    onNameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSurnameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onNicknameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => {
  return (
    <div className="flex items-center">
      <Skeleton
        width="64px"
        height="64px"
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="rounded-lg mr-3"
          src={avatar || '/placeholder/space-avatar-image.png'}
          height={64}
          width={64}
          alt={name && surname ? `${name} ${surname}` : 'Person Avatar'}
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <div className="flex gap-1 mb-1">
              <Input
                value={name}
                onChange={onNameChange}
                placeholder="Name"
                className="text-2"
              />
              <Input
                value={surname}
                onChange={onSurnameChange}
                placeholder="Surname"
                className="text-2"
              />
            </div>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <Input
              value={nickname}
              onChange={onNicknameChange}
              placeholder="Nickname"
              className="text-1 text-neutral-11"
            />
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
