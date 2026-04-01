'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingBackdrop,
  LucideReactIcon,
  MultiSelect,
  RequirementMark,
  RichTextEditor,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  CoherenceType,
  schemaCreateCoherenceForm,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMatrix,
  useMe,
} from '@hypha-platform/core/client';
import React from 'react';
import { useScrollToErrors } from '../../hooks';
import { useRouter } from 'next/navigation';
import { CoherenceTypeButton } from './coherence-type-button';
import { CoherencePriorityButton } from './coherence-priority-button';
import { ButtonClose } from '../../common/button-close';
import { CardButtonColorVariant } from '../../common/card-button';

type FormValues = z.infer<typeof schemaCreateCoherenceForm>;

interface CreateSignalFormProps {
  spaceId: number;
  successfulUrl: string;
  closeUrl?: string;
}

export const CreateSignalForm = ({
  spaceId,
  successfulUrl,
  closeUrl,
}: CreateSignalFormProps) => {
  const { person } = useMe();
  const { jwt: authToken } = useJwt();
  const router = useRouter();
  const {
    createCoherence,
    isCreatingCoherence,
    createdCoherence,
    errorCreateCoherenceMutation,
    resetCreateCoherenceMutation,
    updateCoherenceBySlug,
    isUpdatingCoherence,
  } = useCoherenceMutationsWeb2Rsc(authToken);
  const { isMatrixAvailable, createRoom } = useMatrix();

  const progress = React.useMemo(() => {
    return isCreatingCoherence ? 50 : createdCoherence ? 100 : 0;
  }, [isCreatingCoherence, createdCoherence]);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaCreateCoherenceForm),
    defaultValues: {
      title: '',
      description: '',
      creatorId: person?.id,
      spaceId,
      archived: false,
    },
  });

  useScrollToErrors(form, formRef);

  const typeOptions = React.useMemo(() => {
    const computeColor = (colorVariant: string) => {
      return `var(--${colorVariant}-10)`;
    };
    return COHERENCE_TYPE_OPTIONS.map(
      ({ icon, title, description, type, colorVariant }) => ({
        icon: icon as LucideReactIcon,
        title,
        description,
        type,
        colorVariant: colorVariant as CardButtonColorVariant,
        titleColor: computeColor(colorVariant),
      }),
    );
  }, []);

  const priorityOptions = React.useMemo(() => {
    return COHERENCE_PRIORITY_OPTIONS.map(
      ({ title, priority, description, colorVariant }) => ({
        title,
        priority,
        description,
        colorVariant: colorVariant as CardButtonColorVariant,
      }),
    );
  }, []);

  const tagOptions = React.useMemo(() => {
    return COHERENCE_TAGS.map((type) => ({
      value: type,
      label: type,
    }));
  }, []);

  React.useEffect(() => {
    const { isDirty } = form.getFieldState('creatorId');
    if (!isDirty && person?.id) {
      form.setValue('creatorId', person.id, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [person, form]);

  React.useEffect(() => {
    const { isDirty } = form.getFieldState('spaceId');
    if (!isDirty && spaceId) {
      form.setValue('spaceId', spaceId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [spaceId, form]);

  const handleCreate = React.useCallback(
    async (data: FormValues) => {
      console.log('Start Conversation');
      if (!isMatrixAvailable) {
        console.warn(
          'Cannot create conversation since Matrix client is unavailable',
        );
        return;
      }
      try {
        const coherence = await createCoherence({ ...data });
        const { roomId } = await createRoom(coherence.title);
        await updateCoherenceBySlug({ slug: coherence.slug!, roomId });
      } catch (error) {
        console.warn('Could not create conversation:', error);
      }
      router.push(successfulUrl);
    },
    [
      createRoom,
      updateCoherenceBySlug,
      isMatrixAvailable,
      router,
      successfulUrl,
    ],
  );

  const handleInvalid = async (err?: any) => {
    console.log('form errors:', err);
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      progress={progress}
      isLoading={isCreatingCoherence}
      fullHeight={true}
      message={
        errorCreateCoherenceMutation ? (
          <div className="flex flex-col">
            <div>Ouh Snap. There was an error</div>
            <Button onClick={resetCreateCoherenceMutation}>Reset</Button>
          </div>
        ) : (
          <div>Creating new signal</div>
        )
      }
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleCreate, handleInvalid)}
          className="flex flex-col gap-5"
        >
          <div className="flex w-full">
            <div className="flex flex-col w-full justify-between gap-4">
              <div className="flex flex-row w-full">
                <div className="flex grow"></div>
                <ButtonClose
                  closeUrl={closeUrl}
                  className="px-0 md:px-3 align-top"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between w-full gap-4">
            <div className="flex flex-col gap-4 w-full">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Signal title..."
                        className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                        rightIcon={<RequirementMark className="text-4" />}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <div className="w-full flex flex-col gap-3">
                      <FormLabel className="text-foreground">
                        Type <RequirementMark />
                      </FormLabel>
                      <FormControl>
                        <span className="w-full grid grid-cols-2 gap-2">
                          {typeOptions &&
                            typeOptions.map((option, index) => {
                              return (
                                <CoherenceTypeButton
                                  key={`type-option-${index}`}
                                  icon={option.icon}
                                  title={option.title}
                                  description={option.description}
                                  colorVariant={option.colorVariant}
                                  selected={field.value === option.type}
                                  onClick={() => {
                                    form.setValue(
                                      'type',
                                      option.type as CoherenceType,
                                      {
                                        shouldDirty: true,
                                      },
                                    );
                                  }}
                                />
                              );
                            })}
                        </span>
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <div className="w-full flex flex-col gap-3">
                      <FormLabel className="text-foreground">
                        Priority <RequirementMark />
                      </FormLabel>
                      <FormControl>
                        <span className="w-full flex flex-row gap-2">
                          {priorityOptions &&
                            priorityOptions.map((option, index) => {
                              return (
                                <CoherencePriorityButton
                                  key={`priority-option-${index}`}
                                  className="w-full"
                                  title={option.title}
                                  description={option.description}
                                  colorVariant={option.colorVariant}
                                  selected={field.value === option.priority}
                                  onClick={() => {
                                    form.setValue('priority', option.priority, {
                                      shouldDirty: true,
                                    });
                                  }}
                                />
                              );
                            })}
                        </span>
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Tags</FormLabel>
                    <FormControl>
                      <MultiSelect
                        placeholder={'Select one or more'}
                        options={tagOptions}
                        value={field.value}
                        allowToggleAll={false}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground gap-1">
                      Description <RequirementMark />
                    </FormLabel>
                    <FormControl>
                      <RichTextEditor
                        editorRef={null}
                        markdown={field.value}
                        placeholder="Type your description here..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
