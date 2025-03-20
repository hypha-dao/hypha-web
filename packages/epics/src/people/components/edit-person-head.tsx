import { Skeleton } from '@hypha-platform/ui';
import { MemberType } from '@hypha-platform/graphql/rsc';
import { Image } from '@hypha-platform/ui';
import { Input } from '@hypha-platform/ui';
import { UseFormReturn } from 'react-hook-form';
import { FormMessage, FormField, FormItem, FormControl } from '@hypha-platform/ui';

interface Person {
  name?: string;
  surname?: string;
  nickname?: string;
  id?: number;
  description?: string;
  leadImageUrl?: string | undefined;
}

export type EditPersonHeadProps = {
  isLoading?: boolean;
  nickname?: string;
  form?: UseFormReturn<Person>
};

export const EditPersonHead = ({
  name,
  surname,
  avatar,
  isLoading,
  form,
}: EditPersonHeadProps & MemberType) => {
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
              <FormField
                control={form?.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                    <Input
                      placeholder="Name"
                      className="text-2 text-neutral-11"
                      {...field}
                    />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form?.control}
                name="surname"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                    <Input
                      placeholder="Surname"
                      className="text-2 text-neutral-11"
                      {...field}
                    />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <FormField
              control={form?.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                  <Input
                    placeholder="Nickname"
                    className="text-1 text-neutral-11"
                    {...field}
                  />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
