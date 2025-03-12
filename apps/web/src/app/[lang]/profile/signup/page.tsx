'use client';

import React from 'react';
import { useCreateProfile } from '@web/hooks/use-create-profile';
import { Button, Input } from '@hypha-platform/ui';

import { ImageUploader } from '@hypha-platform/ui';
import { useUploadThingFileUploader } from '@web/hooks/use-uploadthing-file-uploader';

export default function SignupPage() {
  const { createProfile } = useCreateProfile();

  const [name, setName] = React.useState('');
  const [surname, setSurname] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [nickname, setNickname] = React.useState('');

  const { isUploading, uploadedFile, setUploadedFile, handleDrop } =
    useUploadThingFileUploader({
      onUploadComplete: (url: string) => {
        setUploadedFile(url);
      },
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newProfile = await createProfile({
        name,
        surname,
        email,
        avatarUrl,
        leadImageUrl: uploadedFile ?? '',
        description,
        location,
        nickname,
      });

      console.log('Profile created:', newProfile);
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Failed to create profile');
    }
  };

  return (
    <div>
      <h1>Create Profile</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Surname:</label>
          <Input
            type="text"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Email:</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Avatar URL:</label>
          <Input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </div>

        <div>
          <label>Lead image URL:</label>
          <ImageUploader
            isUploading={isUploading}
            uploadedFile={uploadedFile}
            onReset={() => setUploadedFile(null)}
            onUpload={handleDrop}
          />
        </div>

        <div>
          <label>Description:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label>Location:</label>
          <Input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label>Nickname:</label>
          <Input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
        </div>

        <Button type="submit">Create Profile</Button>
      </form>
    </div>
  );
}
