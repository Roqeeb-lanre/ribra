import { apiRequest, waitForSessionRestore, type AuthResponse } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore, type User } from '@/stores/auth';
import type { LoginValues, RegisterValues } from './schemas';

export async function register(values: RegisterValues) {
  const data = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: values,
    auth: false,
  });
  useAuthStore.getState().setSession(data.user, data.accessToken);
  return data.user;
}

export async function login(values: LoginValues) {
  const data = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: values,
    auth: false,
  });
  useAuthStore.getState().setSession(data.user, data.accessToken);
  return data.user;
}

export async function logout() {
  try {
    await apiRequest<void>('/auth/logout', { method: 'POST', auth: false });
  } finally {
    useAuthStore.getState().clearSession();
    // Forget the previous user's CVs and reports so the next person can't see them.
    queryClient.clear();
  }
}

export async function googleSignIn(credential: string) {
  const data = await apiRequest<AuthResponse & { isNewUser: boolean }>('/auth/google', {
    method: 'POST',
    body: { credential },
    auth: false,
  });
  useAuthStore.getState().setSession(data.user, data.accessToken);
  return data;
}

// Each email link can only be used once. React runs effects twice in development,
// so remember the request per token instead of sending it twice.
const verifyRequests = new Map<string, Promise<User>>();

export function verifyEmail(token: string): Promise<User> {
  if (!verifyRequests.has(token)) {
    verifyRequests.set(
      token,
      apiRequest<{ user: User }>('/auth/verify-email', {
        method: 'POST',
        body: { token },
        auth: false,
      }).then(async ({ user }) => {
        // When the link is opened, the app is restoring the session at the same moment and may
        // have loaded the profile before it was marked verified. Wait for that, then reload it.
        await waitForSessionRestore();
        if (useAuthStore.getState().accessToken) {
          const me = await apiRequest<{ user: User }>('/auth/me').catch(() => null);
          if (me) useAuthStore.getState().setUser(me.user);
        }
        return user;
      }),
    );
  }
  return verifyRequests.get(token)!;
}

export async function resendVerification() {
  const result = await apiRequest<{ alreadyVerified: boolean }>('/auth/resend-verification', {
    method: 'POST',
  });
  if (result.alreadyVerified) {
    const { user } = await apiRequest<{ user: User }>('/auth/me');
    useAuthStore.getState().setUser(user);
  }
  return result;
}

export function forgotPassword(email: string) {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    auth: false,
  });
}

export async function resetPassword(token: string, password: string) {
  await apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
    auth: false,
  });
  // Every session was ended on the server, including this one.
  useAuthStore.getState().clearSession();
  queryClient.clear();
}
