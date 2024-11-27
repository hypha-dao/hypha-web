'use client';
import { useState } from 'react';
import { Text } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import { TabsContent, Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import { Button, FilterMenu } from '@hypha-platform/ui';
import { CardAsset } from './card-asset';
import { formatCurrencyValue, listAssetsData } from '@hypha-platform/ui-utils';

type ListAssetsProps = Record<string, never>;

type OptionType = {
  label: string,
  value: string
}

type FilterType = {
  value: string,
  options: OptionType[]
}

const assetsFilterSettings: FilterType = {
  value: 'most-recent',
  options: [
    { label: 'All', value: 'all' },
    { label: 'Most recent', value: 'most-recent' }
  ],
};

export const ListAssets: React.FC<ListAssetsProps> = () => {
  const [assets, setAssets] = useState(listAssetsData.assets);
  const loadMoreAssets = () => {
    const newAssets = [
      {
        icon: 'https://s3-alpha-sig.figma.com/img/245b/338d/4199c4b76377fa29775a7d395db0e05d?Expires=1733702400&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=W0HmD12ptSTV7QwJnar5l0QXpYjN87EJIjR3Hqqh7tyEQzRKmqVynUAWjPNLrDte2kxbcXjxXxHCOq-hcg0Skzn3EVLtp~2MWHlU91cMZ49APOTsv4Q6s9il15KZfJftq45R4sgqvGzCT9ol-O8M795I3q1ironeDlCHKuK8nJfB8H8r4ECM8q3UU77GAvO~Us01N26MsnOdLYw3JI3PyWrQHZB95EjSEZSsJt7SQ7YX7D6NmCkEb~yIbYEVD3fEUF3wMmQWsUPGwgtELPtqiHYkKrkbhJl0ARYvLZ0fOJQOfiIY3vVQhB~zIpq8kEMkTNlVHNvI6rvOhf5WVmYYDA__',
        name: 'New Bitcoin',
        symbol: 'BTC',
        value: 5.25791,
        usdEqual: 335887.76,
        type: 'utility'
      },
      {
        icon: 'https://s3-alpha-sig.figma.com/img/245b/338d/4199c4b76377fa29775a7d395db0e05d?Expires=1733702400&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=W0HmD12ptSTV7QwJnar5l0QXpYjN87EJIjR3Hqqh7tyEQzRKmqVynUAWjPNLrDte2kxbcXjxXxHCOq-hcg0Skzn3EVLtp~2MWHlU91cMZ49APOTsv4Q6s9il15KZfJftq45R4sgqvGzCT9ol-O8M795I3q1ironeDlCHKuK8nJfB8H8r4ECM8q3UU77GAvO~Us01N26MsnOdLYw3JI3PyWrQHZB95EjSEZSsJt7SQ7YX7D6NmCkEb~yIbYEVD3fEUF3wMmQWsUPGwgtELPtqiHYkKrkbhJl0ARYvLZ0fOJQOfiIY3vVQhB~zIpq8kEMkTNlVHNvI6rvOhf5WVmYYDA__',
        name: 'New Bitcoin',
        symbol: 'BTC',
        value: 5.25791,
        usdEqual: 335887.76,
        type: 'utility'
      },
    ];
    setAssets(prevAssets => [...prevAssets, ...newAssets]);
  }
  return (
    <div className='w-full mb-6'>
      <div className='flex justify-between items-center mt-6'>
        <Text className='text-lg'>Balance | $ {formatCurrencyValue(listAssetsData.balance)}</Text>
        <div className='flex items-center'>
          <FilterMenu
            value={assetsFilterSettings.value}
            options={assetsFilterSettings.options}
          />
          <Button className='ml-2' variant="action" size="sm">
            <PlusIcon className='mr-2'/>
            Add wallet
          </Button>
        </div>
      </div>
      <TabsContent value="treasury">
        <Tabs defaultValue="all" className='mt-3'>
          <TabsList>
            <TabsTrigger value="all" variant='outlined'>All</TabsTrigger>
            <TabsTrigger value="utility" variant='outlined'>Utility</TabsTrigger>
            <TabsTrigger value="liquid" variant='outlined'>Liquid</TabsTrigger>
            <TabsTrigger value="voice" variant='outlined'>Voice</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <div className="flex items-center flex-col">
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full'>
                {assets.map((asset) => (
                  <CardAsset icon={asset.icon} name={asset.name} symbol={asset.symbol} value={asset.value} usdEqual={asset.usdEqual} type={asset.type}/>
                ))}
              </div>
              <Button onClick={loadMoreAssets} className="rounded-lg w-fit mt-4" variant="outline" size="sm">
                Load more assets
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="utility">
            <div className="my-4 flex items-center flex-col">
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 w-full'>
                {assets.filter((asset) => asset.type === 'utility').map((asset) => (
                  <CardAsset icon={asset.icon} name={asset.name} symbol={asset.symbol} value={asset.value} usdEqual={asset.usdEqual} type={asset.type}/>
                ))}
              </div>
              <Button onClick={loadMoreAssets} className="rounded-lg w-fit mt-4" variant="outline" size="sm">
                Load more assets
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="liquid">
            <div className="my-4 flex items-center flex-col">
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 w-full'>
                {assets.filter((asset) => asset.type === 'liquid').map((asset) => (
                  <CardAsset icon={asset.icon} name={asset.name} symbol={asset.symbol} value={asset.value} usdEqual={asset.usdEqual} type={asset.type}/>
                ))}
              </div>
              <Button onClick={loadMoreAssets} className="rounded-lg w-fit mt-4" variant="outline" size="sm">
                Load more assets
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="voice">
            <div className="my-4 flex items-center flex-col">
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 w-full'>
                {assets.filter((asset) => asset.type === 'voice').map((asset) => (
                  <CardAsset icon={asset.icon} name={asset.name} symbol={asset.symbol} value={asset.value} usdEqual={asset.usdEqual} type={asset.type}/>
                ))}
              </div>
              <Button onClick={loadMoreAssets} className="rounded-lg w-fit mt-4" variant="outline" size="sm">
                Load more assets
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </TabsContent>
    </div>
  )
}