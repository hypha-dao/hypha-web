import {
  ApiConfig,
  createSpaceWeb2,
  updateSpaceWeb2,
  deleteSpaceWeb2,
} from '../web2/api';
import { CreateSpaceInput, Space, UpdateSpaceInput } from '../../types';

/**
 * Hook providing Web2 space mutation operations via REST API
 *
 * This hook centralizes mutation operations (create, update, delete)
 * and is specifically for client-side usage calling REST endpoints.
 */
export const useSpaceMutationsWeb2Rest = (config: ApiConfig) => {
  return {
    /**
     * Create a new space
     */
    create: async (data: CreateSpaceInput): Promise<Space> => {
      return createSpaceWeb2(data, config);
    },

    /**
     * Update an existing space
     */
    update: async (slug: string, data: UpdateSpaceInput): Promise<Space> => {
      return updateSpaceWeb2(data, {
        endpoint: `/api/v1/spaces/${slug}/update`,
        headers: config.headers,
      });
    },

    /**
     * Delete a space
     */
    delete: async (slug: string): Promise<boolean> => {
      return deleteSpaceWeb2(slug, config);
    },
  };
};
