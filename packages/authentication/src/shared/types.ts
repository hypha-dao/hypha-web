export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  wallet?: {
    address?: string;
  };
}

export interface AuthHook {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  exportWallet: () => Promise<void>;
}

export type UseAuthentication = () => AuthHook;
