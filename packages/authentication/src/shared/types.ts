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
  logout: (redirect?: boolean) => void;
  isLoggingIn: boolean;
  setLoggingIn: (value: boolean) => void;
  getAccessToken: () => Promise<string | null>;
  exportWallet: () => Promise<void>;
  isModalOpen: boolean;
}

export type UseAuthentication = () => AuthHook;
