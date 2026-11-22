import { apiRequest, type AuthResponse } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
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
