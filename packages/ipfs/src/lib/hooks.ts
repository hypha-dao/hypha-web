'use client';

import { useState, useCallback, useEffect } from 'react';
import { useIPFSContext } from './context';
import useSWR from 'swr';

export interface UseUploadResult {
  upload: (file: File) => Promise<string>;
  isUploading: boolean;
  error: Error | null;
}

export const useUpload = (): UseUploadResult => {
  const { client, connect, isConnected } = useIPFSContext();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!client) throw new Error('IPFS client not connected');

      if (!isConnected) {
        console.log('Connecting to IPFS client');
        await connect();
      }

      setIsUploading(true);
      setError(null);

      try {
        const cid = await client.upload(file);
        return cid;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        setError(error);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [client],
  );

  return { upload, isUploading, error };
};

export interface UseIPFSFileResult {
  srcUrl: string | null;
  isLoading: boolean;
  error?: Error;
  mutate: () => Promise<void>;
}

const ipfsCache = new Map<string, string>();

export const useIPFSFile = (cid: string | null): UseIPFSFileResult => {
  const { client, connect, isConnected } = useIPFSContext();

  // Fetcher function for SWR
  const fetcher = async (key: string) => {
    if (!isConnected) {
      console.log('Connecting to IPFS client');
      await connect();
    }
    if (!client) throw new Error('IPFS client not connected');
    if (!key) throw new Error('No CID provided');

    // Check cache first
    const cached = ipfsCache.get(key);
    if (cached) return cached;

    const blob = await client.get(key);
    const url = URL.createObjectURL(blob);
    ipfsCache.set(key, url);
    return url;
  };

  // Use SWR for data fetching
  const {
    data: srcUrl,
    error,
    isLoading,
    mutate,
  } = useSWR(cid, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 1000 * 60 * 60, // 1 hour
  });

  // Cleanup object URLs when component unmounts or CID changes
  useEffect(() => {
    return () => {
      if (srcUrl) {
        URL.revokeObjectURL(srcUrl);
        ipfsCache.delete(cid!);
      }
    };
  }, [srcUrl, cid]);

  return {
    srcUrl: srcUrl || null,
    isLoading,
    error,
    mutate: async () => {
      if (cid && ipfsCache.has(cid)) {
        URL.revokeObjectURL(ipfsCache.get(cid)!);
        ipfsCache.delete(cid);
      }
      await mutate();
    },
  };
};

export interface UseIPFSPinResult {
  pin: (cid: string) => Promise<void>;
  unpin: (cid: string) => Promise<void>;
  isPinning: boolean;
  error: Error | null;
}

export const useIPFSPin = (): UseIPFSPinResult => {
  const { client } = useIPFSContext();
  const [isPinning, setIsPinning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pin = useCallback(
    async (cid: string) => {
      if (!client) throw new Error('IPFS client not connected');

      setIsPinning(true);
      setError(null);

      try {
        await client.pin(cid);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to pin file');
        setError(error);
        throw error;
      } finally {
        setIsPinning(false);
      }
    },
    [client],
  );

  const unpin = useCallback(
    async (cid: string) => {
      if (!client) throw new Error('IPFS client not connected');

      setIsPinning(true);
      setError(null);

      try {
        await client.unpin(cid);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to unpin file');
        setError(error);
        throw error;
      } finally {
        setIsPinning(false);
      }
    },
    [client],
  );

  return { pin, unpin, isPinning, error };
};
