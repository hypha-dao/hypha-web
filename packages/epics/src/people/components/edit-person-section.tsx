'use client';
import { EditPersonHead, EditPersonHeadProps } from './edit-person-head';
import { Button, Skeleton, Textarea, Input, Switch } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { useState, useEffect } from 'react';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/lib/utils';
import { Separator, ImageUploader } from '@hypha-platform/ui';
import Link from 'next/link';
import React from 'react';
import { useForm } from 'react-hook-form';
import { UseEditProfile, UseUploadThingFileUploader } from '../hooks/types';

export type EditPersonSectionProps = EditPersonHeadProps & {
  avatar: string;
  name: string;
  surname: string;
  id: number | null;
  nickname: string;
  closeUrl: string;
  description: string;
  leadImageUrl: string;
  onNameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSurnameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNicknameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLeadImageChange?: (files: File[]) => void;
  useEditProfile?: UseEditProfile;
  useUploadThingFileUploader?: UseUploadThingFileUploader;
  successfulEditCallback?: () => void;
};

interface EditPersonFormData {
  name: string;
  surname: string;
  nickname: string;
  description: string;
  leadImage: string;
}

export const EditPersonSection = ({
  isLoading,
  closeUrl,
  avatar,
  name,
  surname,
  id,
  description,
  nickname,
  leadImageUrl,
  onNameChange,
  onSurnameChange,
  onNicknameChange,
  onDescriptionChange,
  onLeadImageChange,
  useEditProfile,
  useUploadThingFileUploader,
  successfulEditCallback,
}: EditPersonSectionProps) => {
  const { register, setValue, watch, handleSubmit } =
    useForm<EditPersonFormData>({
      defaultValues: {
        name: name || '',
        surname: surname || '',
        nickname: nickname || '',
        description: description || '',
        leadImage: leadImageUrl || '',
      },
    });

  if (!useEditProfile) {
    throw new Error('useEditProfile hook is not defined');
  }
  const { editProfile } = useEditProfile();

  if (!useUploadThingFileUploader) {
    throw new Error('useUploadThingFileUploader hook is not defined');
  }
  const { isUploading, setUploadedFile } = useUploadThingFileUploader({
    onUploadComplete: (url: string) => {
      setUploadedFile(url);
    },
  });

  useEffect(() => {
    setUploadedFile(leadImageUrl || '');
  }, [leadImageUrl]);

  useEffect(() => {
    setValue('name', name || '');
    setValue('surname', surname || '');
    setValue('nickname', nickname || '');
    setValue('description', description || '');
    setValue('leadImage', leadImageUrl || '');
  }, [name, surname, nickname, description, leadImageUrl, setValue]);

  useEffect(() => {
    const subscription = watch(
      (
        value: Partial<EditPersonFormData>,
        { name: fieldName }: { name?: keyof EditPersonFormData },
      ) => {
        if (!fieldName) return;

        const event = { target: { value: value[fieldName] || '' } };

        switch (fieldName) {
          case 'name':
            onNameChange?.(event as React.ChangeEvent<HTMLInputElement>);
            break;
          case 'surname':
            onSurnameChange?.(event as React.ChangeEvent<HTMLInputElement>);
            break;
          case 'nickname':
            onNicknameChange?.(event as React.ChangeEvent<HTMLInputElement>);
            break;
          case 'description':
            onDescriptionChange?.(event as React.ChangeEvent<HTMLInputElement>);
            break;
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [
    watch,
    onNameChange,
    onSurnameChange,
    onNicknameChange,
    onDescriptionChange,
  ]);

  const handleImageUpload = (files: File[]) => {
    if (files.length > 0) {
      const fileUrl = URL.createObjectURL(files[0]);
      setValue('leadImage', fileUrl);
      onLeadImageChange?.(files);
    }
  };

  const [activeLinks, setActiveLinks] = useState({
    website: false,
    linkedin: false,
    x: false,
  });

  const handleLinkToggle = React.useCallback(
    (field: keyof typeof activeLinks) => (isActive: boolean) => {
      setActiveLinks({ ...activeLinks, [field]: isActive });
    },
    [activeLinks, setActiveLinks],
  );

  const saveChanges = async () => {
    try {
      const updatedProfile = await editProfile({
        name: watch('name'),
        surname: watch('surname'),
        nickname: watch('nickname'),
        leadImageUrl: watch('leadImage'),
        description: watch('description'),
        id: id,
      });
      console.log('Profile updated:', updatedProfile);
      successfulEditCallback?.();
    } catch (error) {
      console.error('Error editing profile:', error);
      alert('Failed to edit profile');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <EditPersonHead
          avatar={avatar}
          name={watch('name')}
          surname={watch('surname')}
          nickname={watch('nickname')}
          isLoading={isLoading}
          onNameChange={(e) => setValue('name', e.target.value)}
          onSurnameChange={(e) => setValue('surname', e.target.value)}
          onNicknameChange={(e) => setValue('nickname', e.target.value)}
        />
        <Link href={closeUrl} scroll={false}>
          <Button
            variant="ghost"
            colorVariant="neutral"
            className="flex items-center"
          >
            Close
            <RxCross1 className="ml-2" />
          </Button>
        </Link>
      </div>
      <Separator />
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <ImageUploader
          isUploading={isUploading}
          uploadedFile={watch('leadImage')}
          onReset={() => {
            setValue('leadImage', '');
            onLeadImageChange?.([]);
          }}
          onUpload={handleImageUpload}
        />
      </Skeleton>
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <Textarea
          {...register('description')}
          placeholder="Enter description"
          disabled={isLoading}
        />
      </Skeleton>
      <div className="flex gap-6 flex-col">
        <div className="flex justify-between">
          <Text
            className={cn(
              'text-2',
              activeLinks.website ? 'text-neutral-11' : 'text-neutral-8',
            )}
          >
            Website
          </Text>
          <span className="flex items-center">
            <Input
              placeholder="Add your URL"
              disabled={!activeLinks.website}
              className={cn(
                'text-2 mr-3',
                !activeLinks.website ? 'bg-neutral-6' : '',
              )}
            />
            <Switch
              checked={activeLinks.website}
              onCheckedChange={handleLinkToggle('website')}
            />
          </span>
        </div>
        <div className="flex justify-between">
          <Text
            className={cn(
              'text-2',
              activeLinks.website ? 'text-neutral-11' : 'text-neutral-8',
            )}
          >
            LinkedIn
          </Text>
          <span className="flex items-center">
            <Input
              placeholder="Add your URL"
              disabled={!activeLinks.linkedin}
              className={cn(
                'text-2 mr-3',
                !activeLinks.linkedin ? 'bg-neutral-6' : '',
              )}
            />
            <Switch
              checked={activeLinks.linkedin}
              onCheckedChange={handleLinkToggle('linkedin')}
            />
          </span>
        </div>
        <div className="flex justify-between">
          <Text
            className={cn(
              'text-2',
              activeLinks.x ? 'text-neutral-11' : 'text-neutral-8',
            )}
          >
            X
          </Text>
          <span className="flex items-center">
            <Input
              placeholder="Add your URL"
              disabled={!activeLinks.x}
              className={cn(
                'text-2 mr-3',
                !activeLinks.x ? 'bg-neutral-6' : '',
              )}
            />
            <Switch
              checked={activeLinks.x}
              onCheckedChange={handleLinkToggle('x')}
            />
          </span>
        </div>
      </div>
      <div className="flex justify-end w-full">
        <Skeleton
          width="72px"
          height="35px"
          loading={isLoading}
          className="rounded-lg"
        >
          <Button
            variant="default"
            className="rounded-lg justify-start text-white w-fit"
            onClick={handleSubmit(saveChanges)}
          >
            Save
          </Button>
        </Skeleton>
      </div>
    </div>
  );
};
