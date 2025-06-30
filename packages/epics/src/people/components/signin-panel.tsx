import Link from 'next/link';
import { Button, Skeleton, Separator, Card } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { PlusCircledIcon, PersonIcon } from '@radix-ui/react-icons';

interface SigninPanelProps {
  closeUrl: string;
  onLogin: () => void;
  isLoading: boolean;
}

export const SigninPanel = ({
  closeUrl,
  isLoading,
  onLogin,
}: SigninPanelProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-6 justify-between">
        <div className="text-4 font-medium">Sign in</div>
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
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <div className="text-2 text-neutral-11">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </div>
      </Skeleton>
      <Separator />
      <div className="flex flex-col gap-2">
        <Card
          onClick={onLogin}
          className="flex p-6 cursor-pointer space-x-4 items-center"
        >
          <div>
            <PlusCircledIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-2 font-medium">
              Create a new Hypha Network Account
            </span>
            <span className="text-1 text-neutral-11">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </span>
          </div>
        </Card>
        <Card
          onClick={onLogin}
          className="flex p-6 cursor-pointer space-x-4 items-center"
        >
          <div>
            <PersonIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-2 font-medium">
              Log in to your Hypha Network Account
            </span>
            <span className="text-1 text-neutral-11">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};
