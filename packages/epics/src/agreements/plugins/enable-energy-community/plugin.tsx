'use client';

import React from 'react';
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@hypha-platform/ui';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useFieldArray, useFormContext } from 'react-hook-form';

export const EnableEnergyCommunityPlugin = () => {
  const { control } = useFormContext();
  const {
    fields: sourceFields,
    append: appendSource,
    remove: removeSource,
  } = useFieldArray({
    control,
    name: 'energyCommunityActivation.sources',
  });
  const {
    fields: memberFields,
    append: appendMember,
    remove: removeMember,
  } = useFieldArray({
    control,
    name: 'energyCommunityActivation.members',
  });

  React.useEffect(() => {
    if (sourceFields.length === 0) {
      appendSource({
        sourceId: '',
        sourceType: '',
        tokenName: '',
        tokenSymbol: '',
        basePricePerKwh: '',
        holdersCsv: '',
        holderAmountsCsv: '',
      });
    }
  }, [appendSource, sourceFields.length]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="energyCommunityActivation.admin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Admin Address (space executor)</FormLabel>
            <FormControl>
              <Input
                placeholder="0x..."
                value={field.value ?? ''}
                onChange={field.onChange}
                readOnly
              />
            </FormControl>
            <p className="text-2 text-secondary-foreground">
              Auto-filled with this space&rsquo;s executor. The DAO proposal
              executes the factory call from this address, so it must own the
              new community for Hypha to discover it.
            </p>
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

      <div className="md:col-span-2 flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="text-1 font-medium">Energy Sources</div>
        {sourceFields.map((sourceField, index) => (
          <div
            key={sourceField.id}
            className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 md:grid-cols-2"
          >
            <FormField
              control={control}
              name={`energyCommunityActivation.sources.${index}.sourceId`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. SOLAR_A"
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
              name={`energyCommunityActivation.sources.${index}.sourceType`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SOLAR or BATTERY"
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
              name={`energyCommunityActivation.sources.${index}.tokenName`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ownership Token Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Solar A"
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
              name={`energyCommunityActivation.sources.${index}.tokenSymbol`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ownership Token Symbol</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. SOLA"
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
              name={`energyCommunityActivation.sources.${index}.basePricePerKwh`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Price Per kWh</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="integer wei value"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div />
            <FormField
              control={control}
              name={`energyCommunityActivation.sources.${index}.holdersCsv`}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Holder Addresses (comma separated)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x...,0x..."
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
              name={`energyCommunityActivation.sources.${index}.holderAmountsCsv`}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>
                    Holder Amounts (comma separated, same order)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="1000000000000000000,2000000000000000000"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeSource(index)}
                disabled={sourceFields.length <= 1}
              >
                <Cross2Icon />
                Remove Source
              </Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              appendSource({
                sourceId: '',
                sourceType: '',
                tokenName: '',
                tokenSymbol: '',
                basePricePerKwh: '',
                holdersCsv: '',
                holderAmountsCsv: '',
              })
            }
          >
            <PlusIcon />
            Add Source
          </Button>
        </div>
      </div>

      <div className="md:col-span-2 flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="text-1 font-medium">Energy Members (optional)</div>
        {memberFields.map((memberField, index) => (
          <div
            key={memberField.id}
            className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 md:grid-cols-2"
          >
            <FormField
              control={control}
              name={`energyCommunityActivation.members.${index}.memberAddress`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member Address</FormLabel>
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
              name={`energyCommunityActivation.members.${index}.metadataHash`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metadata Hash (bytes32)</FormLabel>
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
              name={`energyCommunityActivation.members.${index}.deviceIdsCsv`}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Device IDs (comma separated)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="101,102"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeMember(index)}
              >
                <Cross2Icon />
                Remove Member
              </Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              appendMember({
                memberAddress: '',
                metadataHash: '',
                deviceIdsCsv: '',
              })
            }
          >
            <PlusIcon />
            Add Member
          </Button>
        </div>
      </div>
    </div>
  );
};
