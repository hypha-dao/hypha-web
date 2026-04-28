import crypto from 'node:crypto';
import { hashHmacSha1Hex } from '../../common/server/encrypt-aes';
import { encryptMatrixToken } from '../../common/server/encrypt-matrix-token';

type VersionsResponse = {
  versions: Array<string>;
  unstable_features: Record<string, string>;
};

type RegisterResponse = {
  accessToken: string;
  userId: string;
  deviceId: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function createMatrixDeviceId(): string {
  return `hypha_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class MatrixSharedSecret {
  private registrationSharedSecret: string;
  private matrixHomeserverUrl: string;
  private matrixDomain: string;

  constructor() {
    const registrationSharedSecret =
      process.env.MATRIX_REGISTRATION_SHARED_SECRET;
    const matrixHomeserverUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL;
    const matrixDomain = process.env.MATRIX_DOMAIN;

    if (!registrationSharedSecret) {
      throw new Error('MATRIX_REGISTRATION_SHARED_SECRET is not set');
    }
    if (!matrixHomeserverUrl) {
      throw new Error('NEXT_PUBLIC_MATRIX_HOMESERVER_URL is not set');
    }
    if (!matrixDomain) {
      throw new Error('MATRIX_DOMAIN is not set');
    }

    this.registrationSharedSecret = registrationSharedSecret;
    this.matrixHomeserverUrl = matrixHomeserverUrl;
    this.matrixDomain = matrixDomain;
  }
  private versions: VersionsResponse = { versions: [], unstable_features: {} };

  private async getVersions(): Promise<VersionsResponse> {
    if (this.versions.versions.length === 0) {
      const response = await fetchWithTimeout(
        `${this.matrixHomeserverUrl}/_matrix/client/versions`,
      );
      if (response.ok) {
        this.versions = await response.json();
      }
    }
    return this.versions;
  }

  private async getEffectiveVersion() {
    const versions = await this.getVersions();
    const useV3 =
      versions.versions?.some((v) => {
        const match = v.match(/^v1\.(\d+)$/);
        return match?.[1] != null && parseInt(match[1], 10) >= 1;
      }) || false;
    return useV3 ? 'v3' : 'r0';
  }

  private async getNonce(): Promise<string> {
    const response = await fetchWithTimeout(
      `${this.matrixHomeserverUrl}/_synapse/admin/v1/register`,
    );
    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      throw new Error(
        `Failed to get nonce: ${response.status} ${response.statusText} - ${body}`,
      );
    }
    const data = await response.json();
    return data.nonce;
  }

  async isUsernameAvailable(username: string) {
    const version = await this.getEffectiveVersion();
    const endpoint = `/_matrix/client/${version}/register/available`;

    const response = await fetchWithTimeout(
      `${this.matrixHomeserverUrl}${endpoint}?username=${encodeURIComponent(
        username,
      )}`,
    );
    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      throw new Error(
        `Failed to check username availability for ${username}: ${response.status} ${response.statusText} - ${body}`,
      );
    }
    const available = await response.json();
    return available.available;
  }

  async getUser(userName: string, adminAccessToken: string) {
    const version = await this.getEffectiveVersion();
    const matrixUserName = `@${userName}:${this.matrixDomain}`;
    const endpoint = `/_matrix/client/${version}/admin/whois/${encodeURIComponent(
      matrixUserName,
    )}`;
    const response = await fetchWithTimeout(
      `${this.matrixHomeserverUrl}${endpoint}`,
      {
        headers: {
          Authorization: `Bearer ${adminAccessToken}`,
        },
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      throw new Error(
        `Failed to get user ${matrixUserName}: ${response.status} ${response.statusText} - ${body}`,
      );
    }
    const result = await response.json();
    return {
      userId: result.user_id,
      devices: result.devices,
    };
  }

  async registerUserNonce(username: string, isAdmin: boolean = false) {
    const nonce = await this.getNonce();
    const endpoint = '/_synapse/admin/v1/register';
    const password = crypto.randomBytes(32).toString('hex');
    const admin = isAdmin ? 'admin' : 'notadmin';
    const text = `${nonce}\0${username}\0${password}\0${admin}`;
    const mac = hashHmacSha1Hex(text, this.registrationSharedSecret);
    const registerBody = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nonce,
        username,
        password,
        admin: isAdmin,
        device_id: createMatrixDeviceId(),
        initial_device_display_name: 'Hypha Web',
        mac,
      }),
    } as const;
    const response = await fetchWithTimeout(
      `${this.matrixHomeserverUrl}${endpoint}`,
      registerBody,
    );
    return response;
  }

  async registerUser(
    username: string,
    isAdmin: boolean = false,
  ): Promise<RegisterResponse> {
    const response = await this.registerUserNonce(username, isAdmin);
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Failed to register user: ${response.status} ${response.statusText} - non-JSON response: ${text}`,
      );
    }

    const errorData = data as { errcode?: string; error?: string } | null;
    const successData = data as {
      access_token?: string;
      user_id?: string;
      device_id?: string;
    } | null;

    if (!response.ok) {
      console.warn(
        'Cannot register user:',
        errorData?.errcode ?? 'unknown error',
      );

      if (errorData?.errcode === 'M_USER_IN_USE') {
        return {
          accessToken: '',
          userId: '',
          deviceId: '',
        };
      }

      throw new Error(
        `Failed to register user: ${errorData?.errcode ?? response.statusText}`,
      );
    }

    if (!successData?.access_token) {
      throw new Error('Registration succeeded but no access_token returned');
    }

    // Attempt to change password to invalidate the registration password.
    // Non-fatal: some Matrix servers require UIA for password changes.
    try {
      await this.changePassword(
        successData.access_token,
        crypto.randomBytes(32).toString('hex'),
      );
    } catch (error) {
      console.warn(
        'Post-registration password change failed (non-fatal):',
        error instanceof Error ? error.message : error,
      );
    }

    return {
      accessToken: encryptMatrixToken(successData.access_token),
      userId: successData.user_id ?? '',
      deviceId: successData.device_id ?? '',
    };
  }

  async resetPassword(username: string, adminAccessToken: string) {
    const password = crypto.randomBytes(32).toString('hex');
    const response = await fetchWithTimeout(
      `${
        this.matrixHomeserverUrl
      }/_dendrite/admin/resetPassword/${encodeURIComponent(username)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`,
        },
        body: JSON.stringify({
          password,
          logout_devices: true,
        }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `Failed to reset password for ${username}: ${response.status} - ${
          data?.errcode ?? data?.error ?? 'unknown'
        }`,
      );
    }
    if (data?.password_updated === false) {
      throw new Error(`Password reset for ${username} was not applied`);
    }
    return { ok: true, password };
  }

  async removeUser(username: string, adminAccessToken: string) {
    const response = await fetchWithTimeout(
      `${
        this.matrixHomeserverUrl
      }/_dendrite/admin/deactivate/${encodeURIComponent(username)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`,
        },
        body: JSON.stringify({
          erase: true,
        }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `Failed to remove user ${username}: ${response.status} - ${
          data?.errcode ?? data?.error ?? 'unknown'
        }`,
      );
    }
    return { ok: true };
  }

  async validateToken(accessToken: string) {
    try {
      const version = await this.getEffectiveVersion();
      const response = await fetchWithTimeout(
        `${this.matrixHomeserverUrl}/_matrix/client/${version}/account/whoami`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        console.log('Token validation failed:', response.status);
        return false;
      }

      const data = await response.json();
      return data.user_id && data.user_id.includes('@');
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  async loginUser(username: string, password: string) {
    const version = await this.getEffectiveVersion();
    const endpoint = `/_matrix/client/${version}/login`;

    const response = await fetchWithTimeout(
      `${this.matrixHomeserverUrl}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: createMatrixDeviceId(),
          identifier: {
            type: 'm.id.user',
            user: username,
          },
          initial_device_display_name: 'Hypha Web',
          password,
          type: 'm.login.password',
        }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.warn('Cannot login user', {
        status: response.status,
        errcode: data?.errcode,
      });
      throw new Error(data?.error ?? `Cannot login user: ${response.status}`);
    }
    if (!data?.access_token) {
      throw new Error('Login succeeded but no access_token returned');
    }
    return {
      accessToken: encryptMatrixToken(data.access_token),
      userId: data.user_id,
      deviceId: data.device_id,
    };
  }

  private async changePassword(accessToken: string, newPassword: string) {
    const version = await this.getEffectiveVersion();
    const endpoint = `/_matrix/client/${version}/account/password`;

    const response = await fetchWithTimeout(
      `${this.matrixHomeserverUrl}${endpoint}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_password: newPassword,
          logout_devices: true,
        }),
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to change password: ${response.status} - ${
          data?.errcode ?? data?.error ?? response.statusText
        }`,
      );
    }
    const data = await response.json();
    return data;
  }
}
