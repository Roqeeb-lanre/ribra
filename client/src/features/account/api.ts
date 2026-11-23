import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useAuthStore, type User } from '@/stores/auth';

export type SessionInfo = {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
};

const sessionsKey = ['sessions'] as const;

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (name: string) =>
      apiRequest<{ user: User }>('/auth/me', { method: 'PATCH', body: { name } }),
    onSuccess: ({ user }) => useAuthStore.getState().setUser(user),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { currentPassword?: string; newPassword: string }) =>
      apiRequest<{ user: User }>('/auth/password', { method: 'POST', body: input }),
    onSuccess: ({ user }) => {
      useAuthStore.getState().setUser(user);
      void queryClient.invalidateQueries({ queryKey: sessionsKey });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: () =>
      apiRequest<{ sessions: SessionInfo[] }>('/auth/sessions').then((d) => d.sessions),
  });
}

export function useSignOutOthers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ signedOut: number }>('/auth/sessions/sign-out-others', { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: sessionsKey }),
  });
}

/** Downloads everything Ribra stores about the user as a JSON file. */
export function useExportData() {
  return useMutation({
    mutationFn: () => apiRequest<unknown>('/auth/me/export'),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ribra-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { password?: string; confirmEmail?: string }) =>
      apiRequest<void>('/auth/me', { method: 'DELETE', body: input }),
    onSuccess: () => {
      useAuthStore.getState().clearSession();
      queryClient.clear();
    },
  });
}

/** "Chrome on macOS" from a browser's user-agent string. Good enough to recognise a device. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';
  const os = /iPhone|iPad/.test(userAgent)
    ? 'iPhone/iPad'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'an unknown system';
  return `${browser} on ${os}`;
}
