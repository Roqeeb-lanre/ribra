import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Analysis, AnalysisSummary, Resume, Usage } from './types';

/**
 * React Query hooks for everything CV-related. They cache results, show loading states
 * and refresh the right lists automatically after an upload, delete or analysis.
 */

export const cvKeys = {
  resumes: ['resumes'] as const,
  analyses: ['analyses'] as const,
  analysis: (id: string) => ['analyses', id] as const,
  usage: ['usage'] as const,
};

export function useResumes() {
  return useQuery({
    queryKey: cvKeys.resumes,
    queryFn: () => apiRequest<{ resumes: Resume[] }>('/resumes').then((d) => d.resumes),
  });
}

export function useAnalyses() {
  return useQuery({
    queryKey: cvKeys.analyses,
    queryFn: () => apiRequest<{ analyses: AnalysisSummary[] }>('/analyses').then((d) => d.analyses),
  });
}

export function useAnalysis(id: string) {
  return useQuery({
    queryKey: cvKeys.analysis(id),
    queryFn: () => apiRequest<{ analysis: Analysis }>(`/analyses/${id}`).then((d) => d.analysis),
  });
}

export function useUsage() {
  return useQuery({
    queryKey: cvKeys.usage,
    queryFn: () => apiRequest<{ usage: Usage }>('/usage').then((d) => d.usage),
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiRequest<{ resume: Resume }>('/resumes', { method: 'POST', body: form }).then(
        (d) => d.resume,
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cvKeys.resumes }),
  });
}

export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/resumes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cvKeys.resumes });
      void queryClient.invalidateQueries({ queryKey: cvKeys.analyses });
      // Deleting a CV also deletes its job matches on the server.
      void queryClient.invalidateQueries({ queryKey: ['job-matches'] });
    },
  });
}

export function useAnalyzeResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, targetRole }: { resumeId: string; targetRole?: string }) =>
      apiRequest<{ analysis: Analysis }>(`/resumes/${resumeId}/analyze`, {
        method: 'POST',
        body: { targetRole: targetRole?.trim() || undefined },
      }).then((d) => d.analysis),
    onSuccess: (analysis) => {
      queryClient.setQueryData(cvKeys.analysis(analysis.id), analysis);
      void queryClient.invalidateQueries({ queryKey: cvKeys.resumes });
      void queryClient.invalidateQueries({ queryKey: cvKeys.analyses });
      void queryClient.invalidateQueries({ queryKey: cvKeys.usage });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: cvKeys.usage }),
  });
}
