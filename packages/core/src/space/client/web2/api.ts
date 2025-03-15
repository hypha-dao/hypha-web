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

/**
 * Delete a Web2 space by slug
 *
 * @param slug - The slug of the space to delete
 * @param config - The API configuration
 * @returns A boolean indicating whether the deletion was successful
 */
export const deleteSpaceWeb2 = async (
  slug: string,
  config: ApiConfig,
): Promise<boolean> => {
  try {
    const response = await fetch(`/api/v1/spaces/${slug}`, {
      method: 'DELETE',
      headers: {
        ...config.headers,
      },
    });

    return response.ok;
  } catch (error) {
    console.error(`Failed to delete space with slug ${slug}:`, error);
    return false;
  }
};
