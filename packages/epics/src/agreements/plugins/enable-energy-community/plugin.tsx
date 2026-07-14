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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import type { Person, Space } from '@hypha-platform/core/client';
import {
  Cross2Icon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons';
import { useFieldArray, useFormContext } from 'react-hook-form';
import {
  EnergyOptimizationFields,
  PercentageSplitFieldArray,
} from './energy-form-fields';
import { RecipientField } from '../components/common/recipient-field';

type EnableEnergyCommunityPluginProps = {
  members?: Person[];
  spaces?: Space[];
};

const SOURCE_TYPE_OPTIONS = [
  { value: 'SOLAR', label: 'Solar' },
  { value: 'BATTERY', label: 'Battery' },
] as const;

const emptySource = {
  name: '',
  sourceType: 'SOLAR',
  basePricePerKwh: '',
  owners: [],
  tokenName: '',
  tokenSymbol: '',
};

export const EnableEnergyCommunityPlugin = ({
  members = [],
  spaces = [],
}: EnableEnergyCommunityPluginProps) => {
  const { control } = useFormContext();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

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
      appendSource({ ...emptySource });
    }
  }, [appendSource, sourceFields.length]);

  return (
    <div className="flex flex-col gap-4">
      {/* Section 1 + 2 — Optimize for + Social allocation */}
      <EnergyOptimizationFields members={members} spaces={spaces} />

      {/* Section 3 — Members */}
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <div className="text-1 font-medium">Members</div>
          <p className="text-2 text-secondary-foreground">
            Choose community members and how many smart meters each one has.
            Investors with no meter can be left at zero.
          </p>
        </div>
        {memberFields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-3 rounded-md border border-border p-3"
          >
            <RecipientField
              name={`energyCommunityActivation.members.${index}.recipient`}
              members={members}
              spaces={spaces}
              defaultRecipientType="member"
            />
            <div className="flex items-end justify-between gap-2">
              <FormField
                control={control}
                name={`energyCommunityActivation.members.${index}.meterCount`}
                render={({ field: meterField }) => (
                  <FormItem>
                    <FormLabel className="text-2 text-neutral-11">
                      Number of meters
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        className="w-28"
                        placeholder="0"
                        value={meterField.value ?? ''}
                        onChange={meterField.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeMember(index)}
              >
                <Cross2Icon />
                Remove
              </Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => appendMember({ recipient: '', meterCount: '0' })}
          >
            <PlusIcon />
            Add member
          </Button>
        </div>
      </div>

      {/* Section 4 — Energy sources */}
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <div className="text-1 font-medium">Energy sources</div>
          <p className="text-2 text-secondary-foreground">
            Add each generation or storage asset and split its ownership across
            members (shares total 100%).
          </p>
        </div>
        {sourceFields.map((sourceField, index) => (
          <div
            key={sourceField.id}
            className="flex flex-col gap-3 rounded-md border border-border p-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField
                control={control}
                name={`energyCommunityActivation.sources.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Solar Park 1"
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
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <FormLabel>Base price per kWh</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 0.11"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <FormLabel>Ownership</FormLabel>
              <PercentageSplitFieldArray
                name={`energyCommunityActivation.sources.${index}.owners`}
                members={members}
                spaces={spaces}
                addLabel="Add owner"
              />
              <FormField
                control={control}
                name={`energyCommunityActivation.sources.${index}.owners`}
                render={() => (
                  <FormItem>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField
                  control={control}
                  name={`energyCommunityActivation.sources.${index}.tokenName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ownership token name (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="defaults to source name"
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
                      <FormLabel>Ownership token symbol (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="auto-derived"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeSource(index)}
                disabled={sourceFields.length <= 1}
              >
                <Cross2Icon />
                Remove source
              </Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => appendSource({ ...emptySource })}
          >
            <PlusIcon />
            Add source
          </Button>
        </div>
      </div>

      {/* Section 5 — Advanced */}
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <Button
          type="button"
          variant="ghost"
          className="self-start px-0"
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          {showAdvanced ? <ChevronDownIcon /> : <ChevronRightIcon />}
          Advanced settings
        </Button>

        {showAdvanced && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              control={control}
              name="energyCommunityActivation.admin"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Admin address (space executor)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x..."
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      readOnly
                    />
                  </FormControl>
                  <p className="text-2 text-secondary-foreground">
                    Auto-filled with this space&rsquo;s executor. The DAO
                    proposal executes the factory call from this address, so it
                    must own the new community for Hypha to discover it.
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
                  <FormLabel>Stablecoin address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x... (defaults to Base USDC)"
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
                  <FormLabel>Grid operator address (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x... (defaults to executor)"
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
                  <FormLabel>Community fee address (optional)</FormLabel>
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
              name="energyCommunityActivation.communityFeePercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Community fee (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 5"
                      rightIcon={<>%</>}
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
                  <FormLabel>Aggregator fee address (optional)</FormLabel>
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
              name="energyCommunityActivation.aggregatorFeePercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aggregator fee (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 3"
                      rightIcon={<>%</>}
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
                  <FormLabel>Export device ID (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 9999"
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
                  <FormLabel>Energy token name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Community Energy Credit"
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
                  <FormLabel>Energy token symbol</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="NRG"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};
