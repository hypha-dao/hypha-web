'use client';

import { create, IPFSHTTPClient } from 'ipfs-http-client';

const defaultConfig: IPFSClientConfig = {
  host: process.env.NEXT_PUBLIC_IPFS_HOST || 'localhost',
  port: process.env.NEXT_PUBLIC_IPFS_PORT
    ? parseInt(process.env.NEXT_PUBLIC_IPFS_PORT)
    : 5001,
  protocol: process.env.NEXT_PUBLIC_IPFS_PROTOCOL || 'https',
  projectId: process.env.NEXT_PUBLIC_IPFS_PROJECT_ID,
  projectSecret: process.env.NEXT_PUBLIC_IPFS_PROJECT_SECRET,
};

export interface IPFSClientConfig {
  host?: string;
  port?: number;
  protocol?: string;
  projectId?: string;
  projectSecret?: string;
}

export interface IPFSClient {
  upload(file: File | Blob): Promise<string>;
  get(cid: string): Promise<Blob>;
  pin(cid: string): Promise<void>;
  unpin(cid: string): Promise<void>;
}

export class IPFSClientImpl implements IPFSClient {
  private client: IPFSHTTPClient;
  private config: IPFSClientConfig;

  constructor(config: IPFSClientConfig = defaultConfig) {
    if (typeof window === 'undefined') {
      throw new Error('IPFSClient can only be instantiated in the browser');
    }

    this.config = config;
    const { host, port, protocol, projectId, projectSecret } = config;
    console.log('Creating IPFS client with config:', { host, port, protocol });

    try {
      this.client = create({
        host,
        port,
        protocol,
        headers:
          projectId && projectSecret
            ? {
                authorization: `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString('base64')}`,
              }
            : undefined,
      });
    } catch (error) {
      console.error('Failed to create IPFS client:', error);
      throw new Error(
        `Failed to create IPFS client: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async upload(file: File | Blob): Promise<string> {
    try {
      const buffer = await file.arrayBuffer();
      const result = await this.client.add(buffer);
      return result.path;
    } catch (error) {
      console.error('Failed to upload file to IPFS:', error);
      throw new Error(
        `Failed to upload file to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async get(cid: string): Promise<Blob> {
    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }
      if (chunks.length === 0) {
        throw new Error('No data received from IPFS');
      }
      return new Blob(chunks);
    } catch (error) {
      console.error(`Failed to get file from IPFS (CID: ${cid}):`, error);
      throw new Error(
        `Failed to get file from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async pin(cid: string): Promise<void> {
    try {
      await this.client.pin.add(cid);
    } catch (error) {
      console.error(`Failed to pin file (CID: ${cid}):`, error);
      throw new Error(
        `Failed to pin file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async unpin(cid: string): Promise<void> {
    try {
      await this.client.pin.rm(cid);
    } catch (error) {
      console.error(`Failed to unpin file (CID: ${cid}):`, error);
      throw new Error(
        `Failed to unpin file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  getConnectionInfo(): string {
    const { host, port, protocol } = this.config;
    return `${protocol}://${host}:${port}`;
  }
}
