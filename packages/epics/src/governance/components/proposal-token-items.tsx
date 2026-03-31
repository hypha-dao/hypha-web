'use client';

import { Image, Badge, Separator, Skeleton } from '@hypha-platform/ui';
import { DbToken } from '@hypha-platform/core/server';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { EthAddress } from '../../people/components/eth-address';
import { formatCurrencyValue } from '../../../../ui-utils/src/formatCurrencyValue';
import { formatDecayInterval } from '@hypha-platform/ui-utils';
import { usePersonByWeb3Address } from '../hooks';
import { useDbSpaces } from '../../hooks';
import { PersonAvatar } from '../../people/components/person-avatar';
import { useTranslations } from 'next-intl';

interface ProposalTokenItemProps {
  name?: string;
  symbol?: string;
  initialSupply?: bigint;
  dbTokens?: DbToken[];
  address?: string;
  transferable?: boolean;
  fixedMaxSupply?: boolean;
  autoMinting?: boolean;
  priceInUSD?: bigint;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  initialTransferWhitelist?: `0x${string}`[];
  initialReceiveWhitelist?: `0x${string}`[];
  decayPercentage?: bigint;
  decayInterval?: bigint;
}

interface WhitelistAddressItemProps {
  address: `0x${string}`;
}

const WhitelistAddressItem = ({ address }: WhitelistAddressItemProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const { spaces: dbSpaces } = useDbSpaces({
    parentOnly: false,
  });
  const { person, isLoading } = usePersonByWeb3Address(address);

  const space = dbSpaces.find(
    (s) => s.address?.toLowerCase() === address.toLowerCase(),
  );

  return (
    <Skeleton loading={isLoading} className="h-6 w-full">
      <div className="flex items-center gap-2">
        {person ? (
          <>
            <PersonAvatar avatarSrc={person?.avatarUrl} size="sm" />
            <div className="text-1">
              {person?.name} {person?.surname}
            </div>
          </>
        ) : space ? (
          <>
            <Image
              className="rounded-lg w-6 h-6"
              src={space?.logoUrl ?? '/placeholder/default-profile.svg'}
              width={24}
              height={24}
              alt={`${space?.title} logo`}
            />
            <div className="text-1">{space?.title}</div>
          </>
        ) : (
          <>
            <Image
              className="rounded-lg w-6 h-6"
              src="/placeholder/default-profile.svg"
              width={24}
              height={24}
              alt={tProposalDetails('labels.defaultAvatar')}
            />
            <div className="text-1">
              <EthAddress address={address} />
            </div>
          </>
        )}
      </div>
    </Skeleton>
  );
};

export const ProposalTokenItem = ({
  name,
  symbol,
  initialSupply,
  dbTokens,
  address,
  transferable,
  fixedMaxSupply,
  autoMinting,
  priceInUSD,
  useTransferWhitelist,
  useReceiveWhitelist,
  initialTransferWhitelist,
  initialReceiveWhitelist,
  decayPercentage,
  decayInterval,
}: ProposalTokenItemProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tSpaces = useTranslations('Spaces');
  const originalSupply = initialSupply ? Number(initialSupply / 10n ** 18n) : 0;
  const { id } = useParams();
  const { space } = useSpaceBySlug(id as string);

  const dbToken = dbTokens?.find(
    (t) =>
      t.symbol?.toUpperCase() === symbol?.toUpperCase() &&
      t.name?.toUpperCase() === name?.toUpperCase() &&
      t.spaceId == space?.id,
  );
  const tokenIcon = dbToken?.iconUrl;

  const referenceCurrency = dbToken?.referenceCurrency;

  const referencePrice = dbToken?.referencePrice;

  const tokenType = dbToken?.type
    ? tAgreementFlow(
        `plugins.issueNewToken.general.tokenTypeOptions.${dbToken.type}.label` as Parameters<
          typeof tAgreementFlow
        >[0],
      )
    : '';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.tokenType')}
        </div>
        <div className="text-1 text-nowrap">{tokenType}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.tokenName')}
        </div>
        <div className="text-1 text-nowrap">{name}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.tokenSymbol')}
        </div>
        <div className="text-1">{symbol}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.tokenIcon')}
        </div>
        <Image
          className="rounded-full w-7 h-7"
          width={32}
          height={32}
          src={tokenIcon || '/placeholder/neutral-token-icon.svg'}
          alt={tProposalDetails('labels.tokenIconFor', {
            symbol: symbol ?? '',
          })}
        />
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.maxSupply')}
        </div>
        <div className="text-1">
          {Number(originalSupply) === 0
            ? tProposalDetails('labels.unlimited')
            : formatCurrencyValue(Number(originalSupply))}
        </div>
      </div>
      {transferable !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.transferable')}
          </div>
          <div className="text-1">
            {transferable
              ? tProposalDetails('labels.yes')
              : tProposalDetails('labels.no')}
          </div>
        </div>
      )}
      {fixedMaxSupply !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.maxSupplyType')}
          </div>
          <div className="text-1">
            {fixedMaxSupply
              ? tProposalDetails('labels.immutable')
              : tProposalDetails('labels.updatable')}
          </div>
        </div>
      )}
      {autoMinting !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.autoMinting')}
          </div>
          <div className="text-1">
            {autoMinting
              ? tProposalDetails('labels.enabled')
              : tProposalDetails('labels.disabled')}
          </div>
        </div>
      )}
      {dbToken?.archived !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tSpaces('archived')}
          </div>
          <div className="text-1">
            {dbToken.archived
              ? tProposalDetails('labels.yes')
              : tProposalDetails('labels.no')}
          </div>
        </div>
      )}
      {referencePrice && (
        <div className="flex justify-between items-center text-nowrap">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.tokenPrice')}
          </div>
          <div className="text-1">
            {formatCurrencyValue(referencePrice)} {referenceCurrency}
          </div>
        </div>
      )}
      {decayPercentage !== undefined && decayInterval !== undefined && (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="text-1 text-neutral-11 font-medium">
              {tProposalDetails('sections.decaySettings')}
            </div>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                {tProposalDetails('labels.decayPercentage')}
              </div>
              <div className="text-1">{Number(decayPercentage)}%</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                {tProposalDetails('labels.decayInterval')}
              </div>
              <div className="text-1 text-nowrap">
                {formatDecayInterval(decayInterval)}
              </div>
            </div>
          </div>
        </>
      )}

      {((initialTransferWhitelist && initialTransferWhitelist.length > 0) ||
        (initialReceiveWhitelist && initialReceiveWhitelist.length > 0)) && (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="text-1 text-neutral-11 font-medium">
              {tProposalDetails('sections.transferWhitelists')}
            </div>
            {initialTransferWhitelist &&
              initialTransferWhitelist.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="text-1 text-neutral-11 font-bold">
                    {tProposalDetails('sections.fromWhitelist')}
                  </div>
                  <div className="flex flex-col gap-4">
                    {initialTransferWhitelist.map((addr, idx) => (
                      <WhitelistAddressItem key={idx} address={addr} />
                    ))}
                  </div>
                </div>
              )}
            {initialReceiveWhitelist && initialReceiveWhitelist.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="text-1 text-neutral-11 font-bold">
                  {tProposalDetails('sections.toWhitelist')}
                </div>
                <div className="flex flex-col gap-4">
                  {initialReceiveWhitelist.map((addr, idx) => (
                    <WhitelistAddressItem key={idx} address={addr} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
