'use client';

import { useEffect, useRef, useState } from 'react';
import { Separator, Label, Button } from '@hypha-platform/ui';
import { DelegatedMemberSelector } from './delegated-member-selector';
// import { DelegatedSpaceSelector } from './delegated-space-selector';
import { UseMembers } from '../../spaces';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormMessage, FormItem } from '@hypha-platform/ui';
import { z } from 'zod';
import {
  useSpaceBySlug,
  useDelegateWeb3Rpc,
  useMe,
} from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { ProfileComponentParams } from './types';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { useScrollToErrors } from '../../hooks';

interface DelegateVotingSectionProps {
  spaceSlug?: string;
  web3SpaceId?: number;
  useMembers: UseMembers;
}

const delegateToMemberSchema = z.object({
  delegatedSpace: z.number({
    required_error: 'Please select a space',
    invalid_type_error: 'Please select a space',
  }),
  delegatedMember: z.string().min(1, 'Please select a member'),
});
type DelegateToMemberForm = z.infer<typeof delegateToMemberSchema>;

/*
const passOnDelegatedVoiceSchema = z.object({
  delegatedSpace: z.number({
    required_error: 'Please select a space',
    invalid_type_error: 'Please select a space',
  }),
  delegatedMember: z.string().min(1, 'Please select a member'),
});
type PassOnDelegatedVoiceForm = z.infer<typeof passOnDelegatedVoiceSchema>;
*/

export const DelegateVotingSection = ({
  web3SpaceId,
  spaceSlug,
  useMembers,
}: DelegateVotingSectionProps) => {
  const { personSlug: personSlugRaw } = useParams<ProfileComponentParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const { person } = useMe();
  const { space } = useSpaceBySlug(spaceSlug as string);
  const { persons, spaces } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });
  const filteredMembers =
    persons?.data?.filter((member) => member.address !== person?.address) ?? [];
  const isMember = person?.slug === personSlug;

  const {
    delegate: delegateToMember,
    isDelegating: isDelegatingToMember,
    delegateHash: delegateHashMember,
    errorDelegate: errorDelegateMember,
    resetDelegateMutation: resetDelegateMember,
  } = useDelegateWeb3Rpc();

  /*
  const {
    delegate: delegateToSpace,
    isDelegating: isDelegatingToSpace,
    delegateHash: delegateHashSpace,
    errorDelegate: errorDelegateSpace,
    resetDelegateMutation: resetDelegateSpace,
  } = useDelegateWeb3Rpc();
  */

  const [successMember, setSuccessMember] = useState(false);
  /* const [successSpace, setSuccessSpace] = useState(false); */

  useEffect(() => {
    if (delegateHashMember) {
      setSuccessMember(true);
      const t = setTimeout(() => {
        setSuccessMember(false);
        resetDelegateMember();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [delegateHashMember, resetDelegateMember]);

  /*
  useEffect(() => {
    if (delegateHashSpace) {
      setSuccessSpace(true);
      const t = setTimeout(() => {
        setSuccessSpace(false);
        resetDelegateSpace();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [delegateHashSpace, resetDelegateSpace]);
  */

  if (!isMember) return null;

  const delegateToMemberFormRef = useRef<HTMLFormElement>(null);
  const delegateToMemberForm = useForm<DelegateToMemberForm>({
    resolver: zodResolver(delegateToMemberSchema),
    defaultValues: {
      delegatedMember: '',
      delegatedSpace: space?.web3SpaceId as number,
    },
  });

  useScrollToErrors(delegateToMemberForm, delegateToMemberFormRef);

  /*
  const passOnDelegatedVoiceFormRef = useRef<HTMLFormElement>(null);
  const passOnDelegatedVoiceForm = useForm<PassOnDelegatedVoiceForm>({
    resolver: zodResolver(passOnDelegatedVoiceSchema),
    defaultValues: { delegatedSpace: undefined, delegatedMember: '' },
  });

  useScrollToErrors(passOnDelegatedVoiceForm, passOnDelegatedVoiceFormRef);

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
  */

  const handleDelegateToMember = async (data: DelegateToMemberForm) => {
    await delegateToMember({
      address: data.delegatedMember as `0x${string}`,
      spaceId: data.delegatedSpace,
    });
  };

  /*
  const handleDelegateSpace = async (data: PassOnDelegatedVoiceForm) => {
    await delegateToSpace({
      address: data.delegatedMember as `0x${string}`,
      spaceId: data.delegatedSpace,
    });
  };
  */

  return (
    <div className="flex flex-col gap-5">
      <Form {...delegateToMemberForm}>
        <form
          ref={delegateToMemberFormRef}
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
                    Delegated Voting Member
                  </div>
                  <DelegatedMemberSelector
                    members={filteredMembers}
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
            <Button type="submit" disabled={isDelegatingToMember}>
              {isDelegatingToMember ? 'Delegating...' : 'Save'}
            </Button>
          </span>
          {successMember && (
            <span className="text-foreground text-sm">
              Delegation completed successfully!
            </span>
          )}
          {errorDelegateMember && (
            <span className="text-red-600 text-sm">
              {errorDelegateMember.message}
            </span>
          )}
        </form>
      </Form>
      <Separator />
      {/*
      {spaces?.data?.length ? (
        <Form {...passOnDelegatedVoiceForm}>
          <form
            ref={passOnDelegatedVoiceFormRef}
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
                      Delegated Voting Member
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
              <Button type="submit" disabled={isDelegatingToSpace}>
                {isDelegatingToSpace ? 'Delegating...' : 'Save'}
              </Button>
            </span>
            {successSpace && (
              <span className="text-foreground text-sm">
                Delegation completed successfully!
              </span>
            )}
            {errorDelegateSpace && (
              <span className="text-red-600 text-sm">
                {errorDelegateSpace.message}
              </span>
            )}
          </form>
        </Form>
      ) : null} */}
      {/* <Separator /> */}
    </div>
  );
};
