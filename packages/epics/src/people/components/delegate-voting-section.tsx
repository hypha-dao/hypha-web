'use client';

import { useEffect } from 'react';
import { useJoinSpace } from '../../spaces';
import { Separator, Label, Button } from '@hypha-platform/ui';
import { DelegatedMemberSelector } from './delegated-member-selector';
import { DelegatedSpaceSelector } from './delegated-space-selector';
import { UseMembers } from '../../spaces';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormMessage, FormItem } from '@hypha-platform/ui';
import { z } from 'zod';

interface DelegateVotingSectionProps {
  spaceSlug?: string;
  web3SpaceId?: number;
  useMembers: UseMembers;
}

const delegateToMemberSchema = z.object({
  delegatedMember: z.string().min(1, 'Please select a member'),
});

type DelegateToMemberForm = z.infer<typeof delegateToMemberSchema>;

const passOnDelegatedVoiceSchema = z.object({
  delegatedSpace: z.number({
    required_error: 'Please select a space',
    invalid_type_error: 'Please select a space',
  }),
  delegatedMember: z.string().min(1, 'Please select a member'),
});

type PassOnDelegatedVoiceForm = z.infer<typeof passOnDelegatedVoiceSchema>;

export const DelegateVotingSection = ({
  web3SpaceId,
  spaceSlug,
  useMembers,
}: DelegateVotingSectionProps) => {
  const { isMember } = useJoinSpace({
    spaceId: web3SpaceId as number,
  });
  const { persons, spaces } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });

  if (!isMember) return null;

  const delegateToMemberForm = useForm<DelegateToMemberForm>({
    resolver: zodResolver(delegateToMemberSchema),
    defaultValues: { delegatedMember: '' },
  });

  const passOnDelegatedVoiceForm = useForm<PassOnDelegatedVoiceForm>({
    resolver: zodResolver(passOnDelegatedVoiceSchema),
    defaultValues: { delegatedSpace: undefined, delegatedMember: '' },
  });

  const selectedSpaceWeb3SpaceId =
    passOnDelegatedVoiceForm.watch('delegatedSpace');

  const selectedSpace = spaces?.data?.find(
    (s) => s.web3SpaceId === selectedSpaceWeb3SpaceId,
  );

  const { persons: passOnDelegatedVoiceFormMembers } = useMembers({
    spaceSlug: selectedSpace?.slug,
    paginationDisabled: true,
  });

  const { setValue } = passOnDelegatedVoiceForm;
  useEffect(() => {
    setValue('delegatedMember', '');
  }, [selectedSpaceWeb3SpaceId, selectedSpace?.slug, setValue]);

  const handleDelegateToMember = async (data: DelegateToMemberForm) => {
    console.log('Delegating to member:', data.delegatedMember);
  };

  const handleDelegateSpace = async (data: PassOnDelegatedVoiceForm) => {
    console.log(
      'Delegating to space:',
      data.delegatedMember,
      data.delegatedSpace,
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Form {...delegateToMemberForm}>
        <form
          onSubmit={delegateToMemberForm.handleSubmit(handleDelegateToMember)}
          className="flex flex-col gap-5"
        >
          <Label>Delegate to Member</Label>
          <span className="text-2 text-neutral-11">
            Select a member of this space to receive your voting power.
          </span>
          <FormField
            control={delegateToMemberForm.control}
            name="delegatedMember"
            render={({ field }) => (
              <FormItem>
                <span className="flex w-full items-center">
                  <div className="text-2 text-neutral-11 w-full">
                    Delegated Member
                  </div>
                  <DelegatedMemberSelector
                    members={persons?.data}
                    value={field.value}
                    onChange={(selected) =>
                      field.onChange(selected ? selected.address : '')
                    }
                  />
                </span>
                <FormMessage />
              </FormItem>
            )}
          />
          <span className="flex items-center justify-end w-full">
            <Button type="submit">Save</Button>
          </span>
        </form>
      </Form>
      <Separator />
      {spaces?.data?.length ? (
        <Form {...passOnDelegatedVoiceForm}>
          <form
            onSubmit={passOnDelegatedVoiceForm.handleSubmit(
              handleDelegateSpace,
            )}
            className="flex flex-col gap-5"
          >
            <Label>Pass On Delegated Voice</Label>
            <span className="text-2 text-neutral-11">
              Reassign voting power you’ve received in another space to a
              different member of that space.
            </span>
            <FormField
              control={passOnDelegatedVoiceForm.control}
              name="delegatedSpace"
              render={({ field }) => (
                <FormItem>
                  <span className="flex w-full items-center">
                    <div className="text-2 text-neutral-11 w-full">
                      Delegated Voice In
                    </div>
                    <DelegatedSpaceSelector
                      spaces={spaces?.data}
                      value={field.value}
                      onChange={(selected) =>
                        field.onChange(
                          selected ? selected.web3SpaceId : undefined,
                        )
                      }
                    />
                  </span>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passOnDelegatedVoiceForm.control}
              name="delegatedMember"
              render={({ field }) => (
                <FormItem>
                  <span className="flex w-full items-center">
                    <div className="text-2 text-neutral-11 w-full">
                      Delegated Member
                    </div>
                    <DelegatedMemberSelector
                      members={passOnDelegatedVoiceFormMembers?.data}
                      value={field.value}
                      onChange={(selected) =>
                        field.onChange(selected ? selected.address : '')
                      }
                    />
                  </span>
                  <FormMessage />
                </FormItem>
              )}
            />
            <span className="flex items-center justify-end w-full">
              <Button type="submit">Save</Button>
            </span>
          </form>
        </Form>
      ) : null}
      <Separator />
    </div>
  );
};
