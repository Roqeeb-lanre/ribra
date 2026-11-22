import { create } from 'zustand';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  avatarUrl: string | null;
  plan: 'free' | 'pro';
  createdAt: string;
};

type AuthState = {
  user: User | null;
  /** Kept only in memory (never localStorage), so a malicious script can't steal it later. */
  accessToken: string | null;
  /** "checking" while we try to restore the session when the app first loads. */
  status: 'checking' | 'authenticated' | 'guest';
  setSession: (user: User, accessToken: string) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  status: 'checking',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  clearSession: () => set({ user: null, accessToken: null, status: 'guest' }),
}));
