import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Application, ApplicationInput, ApplicationStatus } from './types';

export const applicationKeys = {
  all: ['applications'] as const,
};

export function useApplications() {
  return useQuery({
    queryKey: applicationKeys.all,
    queryFn: () =>
      apiRequest<{ applications: Application[] }>('/applications').then((d) => d.applications),
  });
}

/** Put a changed application at the top of the cached list (the list is newest-updated first). */
function upsert(list: Application[] | undefined, app: Application) {
  return [app, ...(list ?? []).filter((a) => a.id !== app.id)];
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationInput) =>
      apiRequest<{ application: Application }>('/applications', { method: 'POST', body: input }),
    onSuccess: ({ application }) =>
      queryClient.setQueryData<Application[]>(applicationKeys.all, (list) =>
        upsert(list, application),
      ),
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<ApplicationInput> }) =>
      apiRequest<{ application: Application }>(`/applications/${id}`, {
        method: 'PATCH',
        body: changes,
      }),
    onSuccess: ({ application }) =>
      queryClient.setQueryData<Application[]>(applicationKeys.all, (list) =>
        upsert(list, application),
      ),
  });
}

/**
 * Dragging a card to another column: move it on screen straight away,
 * and put it back if the server says no.
 */
export function useMoveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      apiRequest<{ application: Application }>(`/applications/${id}`, {
        method: 'PATCH',
        body: { status },
      }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: applicationKeys.all });
      const previous = queryClient.getQueryData<Application[]>(applicationKeys.all);
      const moved = previous?.find((a) => a.id === id);
      if (moved) {
        queryClient.setQueryData(applicationKeys.all, upsert(previous, { ...moved, status }));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(applicationKeys.all, context.previous);
    },
    onSuccess: ({ application }) =>
      queryClient.setQueryData<Application[]>(applicationKeys.all, (list) =>
        upsert(list, application),
      ),
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/applications/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) =>
      queryClient.setQueryData<Application[]>(applicationKeys.all, (list) =>
        (list ?? []).filter((a) => a.id !== id),
      ),
  });
}

/** "Track this job" on a Job Match report. */
export function useTrackJobMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobMatchId: string) =>
      apiRequest<{ application: Application; created: boolean }>(
        `/applications/from-match/${jobMatchId}`,
        { method: 'POST' },
      ),
    onSuccess: ({ application }) =>
      queryClient.setQueryData<Application[]>(applicationKeys.all, (list) =>
        upsert(list, application),
      ),
  });
}
