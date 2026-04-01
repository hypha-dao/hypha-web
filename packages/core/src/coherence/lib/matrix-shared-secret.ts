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

export class MatrixSharedSecret {
  private registrationSharedSecret =
    process.env.MATRIX_REGISTRATION_SHARED_SECRET!;
  private matrixHomeserverUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL!;
  private matrixDomain = process.env.MATRIX_DOMAIN!;
  private versions: VersionsResponse = { versions: [], unstable_features: {} };

  private async getVersions(): Promise<VersionsResponse> {
    if (this.versions.versions.length === 0) {
      const response = await fetch(
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
    const useV3 = versions.versions?.includes('v1.3') || false;
    const result = useV3 ? 'v3' : 'r0';
    return result;
  }

  private async getNonce(): Promise<string> {
    const response = await fetch(
      `${this.matrixHomeserverUrl}/_synapse/admin/v1/register`,
      {
        headers: {
          Authorization: `Bearer ${this.registrationSharedSecret}`,
        },
      },
    );
    if (!response.ok) {
      return '';
    }
    const data = await response.json();
    return data.nonce;
  }

  async isUsernameAvailable(username: string) {
    const version = await this.getEffectiveVersion();
    const endpoint = `/_matrix/client/${version}/register/available`;

    const response = await fetch(
      `${this.matrixHomeserverUrl}${endpoint}?username=${username}`,
    );
    if (!response.ok) {
      return false;
    }
    const available = await response.json();
    return available.available;
  }

  async getUser(userName: string, adminAccessToken: string) {
    const version = await this.getEffectiveVersion();
    const matrixUserName = `@${userName}:${this.matrixDomain}`;
    const endpoint = `/_matrix/client/${version}/admin/whois/${matrixUserName}`;
    const response = await fetch(`${this.matrixHomeserverUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });
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
        Authorization: `Bearer ${this.registrationSharedSecret}`,
      },
      body: JSON.stringify({
        nonce,
        username,
        password,
        admin: isAdmin,
        mac,
      }),
    } as const;
    const response = await fetch(
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
    const data = await response.json();

    if (!response.ok) {
      console.warn('Cannot register user:', data);

      if (data.errcode === 'M_USER_IN_USE') {
        return {
          accessToken: '',
          userId: '',
          deviceId: '',
        };
      }
    }

    await this.changePassword(
      data.access_token,
      crypto.randomBytes(32).toString('hex'),
    );

    return {
      accessToken: encryptMatrixToken(data.access_token),
      userId: data.user_id,
      deviceId: data.device_id,
    };
  }

  async resetPassword(username: string, adminAccessToken: string) {
    const password = crypto.randomBytes(32).toString('hex');
    const response = await fetch(
      `${this.matrixHomeserverUrl}/_dendrite/admin/resetPassword/${username}`,
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
    const data = await response.json();
    if (!response.ok) {
      console.warn('Cannot reset password', data);
    }
    return { ok: data.password_updated, password };
  }

  async removeUser(username: string) {
    const response = await fetch(
      `${this.matrixHomeserverUrl}/_dendrite/admin/deactivate/${username}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          erase: true,
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      console.warn('Cannot remove user', data);
    }
    return response;
  }

  async validateToken(accessToken: string) {
    try {
      const version = await this.getEffectiveVersion();
      const response = await fetch(
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

    const response = await fetch(`${this.matrixHomeserverUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: {
          type: 'm.id.user',
          user: username,
        },
        initial_device_display_name: `device_${Date.now()}`,
        password,
        type: 'm.login.password',
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.warn('Cannot login user', data);
    }
    console.log('Login data response:', data);
    return {
      accessToken: encryptMatrixToken(data.access_token),
      userId: data.user_id,
      deviceId: data.device_id,
    };
  }

  private async changePassword(accessToken: string, newPassword: string) {
    const version = await this.getEffectiveVersion();
    const endpoint = `/_matrix/client/${version}/account/password`;

    const response = await fetch(`${this.matrixHomeserverUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        new_password: newPassword,
        logout_devices: true,
      }),
    });
    const data = await response.json();
    return data;
  }
}
