'use client';
import { Button, Separator, Skeleton } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import QRCode from 'react-qr-code';
import { CopyIcon, CheckIcon } from '@radix-ui/react-icons';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import { useSpaceDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { ButtonClose, ButtonBack } from '@hypha-platform/epics';

interface DepositFundsProps {
  closeUrl: string;
  backUrl?: string;
  spaceId: number | undefined | null;
  isLoading?: boolean;
}

const important =
  'Only Base mainnet tokens can be deposited to this address. If you send funds from another network, your tokens may be permanently lost and cannot be recovered.';
const description =
  "All deposited tokens are held in the Space's treasury. Any future withdrawals must be approved by passing a proposal in your Space. This ensures transparency and collective decision-making over treasury funds.";

export const DepositFunds = ({
  closeUrl,
  backUrl,
  spaceId,
  isLoading,
}: DepositFundsProps) => {
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: spaceId as number,
  });

  const spaceAddress = spaceDetails?.executor;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col-reverse md:flex-row justify-between gap-4">
        <Skeleton loading={isLoading} width={150} height={30}>
          <Text className="text-4 capitalize text-nowrap">Deposit Funds</Text>
        </Skeleton>
        {!isLoading && (
          <div className="flex gap-2">
            {backUrl && <ButtonBack backUrl={backUrl} />}
            <ButtonClose closeUrl={closeUrl} />
          </div>
        )}
      </div>

      <Skeleton loading={isLoading} width="100%" height={80}>
        <span className="text-2 text-neutral-11">{description}</span>
        <span className="text-2 font-bold uppercase">{important}</span>
      </Skeleton>

      <Separator />

      <Skeleton loading={isLoading} width="100%" height={300}>
        <div className="flex items-center justify-center w-full h-[300px]">
          <QRCode
            className="w-[200px] h-[200px] bg-secondary-foreground p-2 rounded-xl"
            value={spaceAddress || ''}
          />
        </div>
      </Skeleton>

      <Skeleton loading={isLoading} width="100%" height={40}>
        <span className="flex justify-between items-center px-2 py-1 bg-secondary border borged-neutral-5 rounded-lg">
          <span className="text-neutral-9 overflow-hidden whitespace-nowrap text-ellipsis pr-6">{spaceAddress}</span>
          <CopyIcon
            className="cursor-pointer"
            onClick={() => {
              if (!isLoading) copyToClipboard(spaceAddress as string);
            }}
          />
        </span>
      </Skeleton>

      <Separator />

      <Skeleton loading={isLoading} width={300} height={30}>
        <Text className="text-4 capitalize text-nowrap">
          Please double-check the following:
        </Text>
      </Skeleton>

      <Skeleton loading={isLoading} width="100%" height={20}>
        <span className="flex items-center text-neutral-11 text-1 gap-3">
          <CheckIcon />
          You are depositing Base mainnet tokens, not from any other network.
        </span>
      </Skeleton>

      <Skeleton loading={isLoading} width="100%" height={20}>
        <span className="flex items-center text-neutral-11 text-1 gap-3">
          <CheckIcon />
          You understand that tokens can only be withdrawn after a successful
          proposal.
        </span>
      </Skeleton>

      <Skeleton loading={isLoading} width="100%" height={20}>
        <span className="flex items-center text-neutral-11 text-1 gap-3">
          <CheckIcon />
          By proceeding, you acknowledge these conditions and confirm your
          deposit transaction.
        </span>
      </Skeleton>

      <div className="flex justify-end">
        <Skeleton loading={isLoading} width={150} height={40}>
          <Button
            onClick={() => {
              if (!isLoading) copyToClipboard(spaceAddress as string);
            }}
            disabled={isLoading}
          >
            Copy Address
          </Button>
        </Skeleton>
      </div>
    </div>
  );
};
