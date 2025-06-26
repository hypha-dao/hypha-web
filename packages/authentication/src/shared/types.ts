export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  wallet?: {
    address?: `0x${string}`;
  };
}

export interface AuthHook {
  isAuthenticated: boolean;
  isLoading: boolean;
  isEmbeddedWallet: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  exportWallet: () => Promise<void>;
}

export type UseAuthentication = () => AuthHook;
