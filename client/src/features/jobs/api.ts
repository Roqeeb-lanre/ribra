import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { cvKeys } from '@/features/cv/api';
import { applicationKeys } from '@/features/applications/api';
import type { CreateJobMatchInput, JobMatch, JobMatchSummary } from './types';

export const jobKeys = {
  all: ['job-matches'] as const,
  one: (id: string) => ['job-matches', id] as const,
};

export function useJobMatches() {
  return useQuery({
    queryKey: jobKeys.all,
    queryFn: () =>
      apiRequest<{ matches: JobMatchSummary[] }>('/job-matches').then((d) => d.matches),
  });
}

export function useJobMatch(id: string) {
  return useQuery({
    queryKey: jobKeys.one(id),
    queryFn: () => apiRequest<{ match: JobMatch }>(`/job-matches/${id}`).then((d) => d.match),
  });
}

export function useCreateJobMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobMatchInput) =>
      apiRequest<{ match: JobMatch; cached: boolean }>('/job-matches', {
        method: 'POST',
        body: {
          ...input,
          jobTitle: input.jobTitle?.trim() || undefined,
          company: input.company?.trim() || undefined,
        },
      }),
    onSuccess: ({ match }) => {
      queryClient.setQueryData(jobKeys.one(match.id), match);
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: cvKeys.usage });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: cvKeys.usage }),
  });
}

export function useDeleteJobMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/job-matches/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      // Tracked applications stay, but lose their link to the deleted match.
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    },
  });
}
