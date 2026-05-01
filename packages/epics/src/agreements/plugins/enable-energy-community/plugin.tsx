'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export const EnableEnergyCommunityPlugin = () => {
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="energyCommunityActivation.admin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Admin Address</FormLabel>
            <FormControl>
              <Input
                placeholder="0x..."
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.stablecoin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Stablecoin Address</FormLabel>
            <FormControl>
              <Input
                placeholder="0x..."
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.gridOperator"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Grid Operator Address</FormLabel>
            <FormControl>
              <Input
                placeholder="0x..."
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.communityAddress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Community Address (optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="0x..."
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.aggregatorAddress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Aggregator Address (optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="0x..."
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.exportDeviceId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Export Device ID (optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. 1001"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.communityFeeBps"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Community Fee BPS (optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. 100"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.aggregatorFeeBps"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Aggregator Fee BPS (optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. 50"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.energyTokenName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Energy Token Name</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Community Energy Credit"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.energyTokenSymbol"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Energy Token Symbol</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. CEC"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.sourcesJson"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Sources JSON (required)</FormLabel>
            <FormControl>
              <Textarea
                rows={8}
                placeholder='[{"sourceId":"SOLAR_A","sourceType":"SOLAR","tokenName":"Solar A","tokenSymbol":"SOLA","basePricePerKwh":"1000000000000000000","holders":["0x..."],"holderAmounts":["1000000000000000000"]}]'
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="energyCommunityActivation.membersJson"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Members JSON (optional)</FormLabel>
            <FormControl>
              <Textarea
                rows={6}
                placeholder='[{"memberAddress":"0x...","deviceIds":[101,102],"metadataHash":"0x0000000000000000000000000000000000000000000000000000000000000000"}]'
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
