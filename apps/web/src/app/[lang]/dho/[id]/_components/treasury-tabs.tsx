'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AssetsSection,
  BankingSection,
  TransactionsSection,
  VaultsSection,
  useAssets,
  useBankCustomerStatus,
  useTransfers,
  useVaults,
  useVirtualAccounts,
} from '@hypha-platform/epics';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@hypha-platform/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { TabScreenTitle } from '../@tab/_components/tab-screen-title';

type TreasuryTabsProps = {
  basePath: string;
  spaceSlug: string;
  web3SpaceId: number;
};

export function TreasuryTabs({
  basePath,
  spaceSlug,
  web3SpaceId,
}: TreasuryTabsProps) {
  const tCommon = useTranslations('Common');
  const tTreasury = useTranslations('TreasuryTab');
  const format = useFormatter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('balance');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'bank-accounts') {
      setActiveTab('bank-accounts');
    }
  }, [searchParams]);
  const { assets } = useAssets({});
  const { transfers } = useTransfers({ spaceSlug });
  const { vaults } = useVaults({ spaceSlug });
  const { status: bankCustomerStatus } = useBankCustomerStatus({ spaceSlug });
  const { accounts: virtualAccounts } = useVirtualAccounts({
    spaceSlug,
    enabled: Boolean(bankCustomerStatus),
  });
  const walletCount = assets.filter((asset) => asset.value > 0).length;
  const transactionCount = transfers.length;
  const vaultCount = vaults.length;
  const bankAccountCount = virtualAccounts.length;

  return (
    <div className="flex w-full flex-col gap-4 py-4">
      <TabScreenTitle title={tCommon('Treasury')} count={walletCount} />
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex w-full flex-col gap-4"
      >
        <div className="flex w-full justify-start">
          <TabsList triggerVariant="switch" className="w-fit">
            <TabsTrigger value="balance" variant="switch">
              <span className="inline-flex items-center gap-1">
                <span>{tTreasury('wallet')}</span>
                <span className="text-xs text-muted-foreground">
                  ({format.number(walletCount)})
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="transactions" variant="switch">
              <span className="inline-flex items-center gap-1">
                <span>{tTreasury('transactions')}</span>
                <span className="text-xs text-muted-foreground">
                  ({format.number(transactionCount)})
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="vaults" variant="switch">
              <span className="inline-flex items-center gap-1">
                <span>{tTreasury('vaults')}</span>
                <span className="text-xs text-muted-foreground">
                  ({format.number(vaultCount)})
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="bank-accounts" variant="switch">
              <span className="inline-flex items-center gap-1">
                <span>{tTreasury('bankAccounts')}</span>
                <span className="text-xs text-muted-foreground">
                  ({format.number(bankAccountCount)})
                </span>
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="balance" className="mt-0">
          <AssetsSection basePath={basePath} web3SpaceId={web3SpaceId} />
        </TabsContent>

        <TabsContent value="transactions" className="mt-0">
          <TransactionsSection spaceSlug={spaceSlug} />
        </TabsContent>

        <TabsContent value="vaults" className="mt-0">
          <VaultsSection />
        </TabsContent>

        <TabsContent value="bank-accounts" className="mt-0">
          <BankingSection spaceSlug={spaceSlug} web3SpaceId={web3SpaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
