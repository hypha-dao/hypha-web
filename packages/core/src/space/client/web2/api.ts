import { CreateSpaceInput, Space, UpdateSpaceInput } from '../../types';

export type ApiConfig = {
  endpoint: string;
  headers: {
    Authorization: string;
  };
};

export const createSpaceWeb2 = async (
  data: CreateSpaceInput,
  config: ApiConfig,
): Promise<Space> => {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      ...config.headers,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create space');
  }

  const createdSpace = await response.json();
  return createdSpace;
};

export const updateSpaceWeb2 = async (
  data: UpdateSpaceInput,
  config: ApiConfig,
): Promise<Space> => {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      ...config.headers,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update space');
  }

  const updatedSpace = await response.json();
  return updatedSpace;
};
